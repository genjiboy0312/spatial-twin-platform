import json
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, Floor, ObjectPlacement, ProjectAsset, ProjectSnapshot, Room, SecurityDevice, UploadAsset, Wall
from app.schemas import (
    FloorRead,
    ObjectPlacementCreate,
    ObjectPlacementRead,
    ObjectPlacementSyncPayload,
    ObjectPlacementUpdate,
    ProjectAssetCreate,
    ProjectAssetRead,
    ProjectAssetUpdate,
    ProjectDataRead,
    ProjectSummaryRead,
    ProjectSnapshotPayload,
    ProjectSnapshotRead,
    SecurityDeviceRead,
    UploadAssetRead,
)

router = APIRouter(prefix="/api", tags=["project-data"])


@router.get("/buildings/{building_id}/project-data", response_model=ProjectDataRead)
def get_project_data(building_id: int, db: Session = Depends(get_db)) -> ProjectDataRead:
    building = _get_building_or_404(db, building_id)
    floors = _building_floors(db, building_id)
    floor_ids = [floor.id for floor in floors]
    uploads = list(
        db.scalars(select(UploadAsset).where(UploadAsset.building_id == building_id).order_by(UploadAsset.id.desc()))
    )
    assets = list(
        db.scalars(select(ProjectAsset).where(ProjectAsset.building_id == building_id).order_by(ProjectAsset.id.desc()))
    )
    placements = list(
        db.scalars(
            select(ObjectPlacement).where(ObjectPlacement.building_id == building_id).order_by(ObjectPlacement.id.desc())
        )
    )
    devices = _devices_for_floors(db, floor_ids)
    counts = Counter(asset.asset_type for asset in assets)
    counts.update(upload.source_type for upload in uploads)
    counts["security_device"] = len(devices)
    counts["object"] = len(placements)

    return ProjectDataRead(
        building=building,
        floors=[FloorRead.model_validate(floor) for floor in floors],
        uploads=[UploadAssetRead.model_validate(upload) for upload in uploads],
        project_assets=[_asset_to_read(asset) for asset in assets],
        object_placements=[_placement_to_read(placement) for placement in placements],
        security_devices=[SecurityDeviceRead.model_validate(device) for device in devices],
        asset_counts=dict(counts),
    )


@router.get("/buildings/{building_id}/project-summary", response_model=ProjectSummaryRead)
def get_project_summary(building_id: int, db: Session = Depends(get_db)) -> ProjectSummaryRead:
    _get_building_or_404(db, building_id)
    floors = _building_floors(db, building_id)
    floor_ids = [floor.id for floor in floors]
    uploads = list(db.scalars(select(UploadAsset).where(UploadAsset.building_id == building_id)))
    assets = list(db.scalars(select(ProjectAsset).where(ProjectAsset.building_id == building_id)))
    placements = list(db.scalars(select(ObjectPlacement).where(ObjectPlacement.building_id == building_id)))
    devices = _devices_for_floors(db, floor_ids)
    wall_count = _count_by_floor_ids(db, Wall, floor_ids)
    room_count = _count_by_floor_ids(db, Room, floor_ids)
    snapshot = db.scalar(select(ProjectSnapshot).where(ProjectSnapshot.building_id == building_id))
    snapshot_state = _json_load(snapshot.state_json) if snapshot else None
    alignment = snapshot_state.get("alignment") if isinstance(snapshot_state, dict) else None

    counts = Counter(asset.asset_type for asset in assets)
    counts.update(upload.source_type for upload in uploads)
    counts["security_device"] = len(devices)
    counts["object"] = len(placements)

    return ProjectSummaryRead(
        building_id=building_id,
        floor_count=len(floors),
        upload_count=len(uploads),
        source_count=sum(1 for upload in uploads if upload.source_type != "pointcloud"),
        pointcloud_count=sum(1 for upload in uploads if upload.source_type == "pointcloud"),
        project_asset_count=len(assets),
        object_count=len(placements),
        device_count=max(_editor_device_count(placements), len(devices)),
        wall_count=wall_count,
        room_count=room_count,
        geometry_count=wall_count + room_count,
        alignment_applied=_alignment_applied(alignment),
        anchor_count=_anchor_count(alignment),
        asset_counts=dict(counts),
    )


@router.get("/buildings/{building_id}/project-snapshot", response_model=ProjectSnapshotRead)
def get_project_snapshot(building_id: int, db: Session = Depends(get_db)) -> ProjectSnapshotRead:
    _get_building_or_404(db, building_id)
    snapshot = db.scalar(select(ProjectSnapshot).where(ProjectSnapshot.building_id == building_id))
    if snapshot is None:
        return ProjectSnapshotRead(building_id=building_id, version=1, state={}, saved=False, updated_at=None)
    return ProjectSnapshotRead(
        building_id=building_id,
        version=snapshot.version,
        state=_json_load(snapshot.state_json) or {},
        saved=True,
        updated_at=snapshot.updated_at,
    )


@router.put("/buildings/{building_id}/project-snapshot", response_model=ProjectSnapshotRead)
def save_project_snapshot(
    building_id: int,
    payload: ProjectSnapshotPayload,
    db: Session = Depends(get_db),
) -> ProjectSnapshotRead:
    _get_building_or_404(db, building_id)
    snapshot = db.scalar(select(ProjectSnapshot).where(ProjectSnapshot.building_id == building_id))
    if snapshot is None:
        snapshot = ProjectSnapshot(building_id=building_id)
        db.add(snapshot)
    snapshot.version = payload.version
    snapshot.state_json = _json_dump(payload.state) or "{}"
    db.commit()
    db.refresh(snapshot)
    return ProjectSnapshotRead(
        building_id=building_id,
        version=snapshot.version,
        state=_json_load(snapshot.state_json) or {},
        saved=True,
        updated_at=snapshot.updated_at,
    )


@router.get("/buildings/{building_id}/assets", response_model=list[ProjectAssetRead])
def list_project_assets(building_id: int, db: Session = Depends(get_db)) -> list[ProjectAssetRead]:
    _get_building_or_404(db, building_id)
    assets = db.scalars(select(ProjectAsset).where(ProjectAsset.building_id == building_id).order_by(ProjectAsset.id.desc()))
    return [_asset_to_read(asset) for asset in assets]


@router.post("/buildings/{building_id}/assets", response_model=ProjectAssetRead, status_code=status.HTTP_201_CREATED)
def create_project_asset(
    building_id: int,
    payload: ProjectAssetCreate,
    db: Session = Depends(get_db),
) -> ProjectAssetRead:
    _get_building_or_404(db, building_id)
    _validate_floor_scope(db, building_id, payload.floor_id)
    _validate_upload_scope(db, building_id, payload.upload_asset_id)
    asset = ProjectAsset(
        building_id=building_id,
        floor_id=payload.floor_id,
        upload_asset_id=payload.upload_asset_id,
        asset_type=payload.asset_type,
        name=payload.name,
        status=payload.status,
        file_uri=payload.file_uri,
        metadata_json=_json_dump(payload.metadata),
    )
    db.add(asset)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project asset") from exc
    db.refresh(asset)
    return _asset_to_read(asset)


@router.patch("/assets/{asset_id}", response_model=ProjectAssetRead)
def update_project_asset(
    asset_id: int,
    payload: ProjectAssetUpdate,
    db: Session = Depends(get_db),
) -> ProjectAssetRead:
    asset = db.get(ProjectAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project asset not found")
    data = payload.model_dump(exclude_unset=True)
    if "floor_id" in data:
        _validate_floor_scope(db, asset.building_id, data["floor_id"])
    if "upload_asset_id" in data:
        _validate_upload_scope(db, asset.building_id, data["upload_asset_id"])
    for field, value in data.items():
        if field == "metadata":
            asset.metadata_json = _json_dump(value)
        else:
            setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return _asset_to_read(asset)


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_asset(asset_id: int, db: Session = Depends(get_db)) -> None:
    asset = db.get(ProjectAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project asset not found")
    db.delete(asset)
    db.commit()


@router.get("/buildings/{building_id}/object-placements", response_model=list[ObjectPlacementRead])
def list_object_placements(building_id: int, db: Session = Depends(get_db)) -> list[ObjectPlacementRead]:
    _get_building_or_404(db, building_id)
    placements = db.scalars(
        select(ObjectPlacement).where(ObjectPlacement.building_id == building_id).order_by(ObjectPlacement.id.desc())
    )
    return [_placement_to_read(placement) for placement in placements]


@router.post(
    "/buildings/{building_id}/object-placements",
    response_model=ObjectPlacementRead,
    status_code=status.HTTP_201_CREATED,
)
def create_object_placement(
    building_id: int,
    payload: ObjectPlacementCreate,
    db: Session = Depends(get_db),
) -> ObjectPlacementRead:
    _get_building_or_404(db, building_id)
    _validate_floor_scope(db, building_id, payload.floor_id)
    _validate_project_asset_scope(db, building_id, payload.source_asset_id)
    placement = ObjectPlacement(
        building_id=building_id,
        floor_id=payload.floor_id,
        source_asset_id=payload.source_asset_id,
        object_type=payload.object_type,
        name=payload.name,
        position_x=payload.position_x,
        position_y=payload.position_y,
        position_z=payload.position_z,
        rotation_x=payload.rotation_x,
        rotation_y=payload.rotation_y,
        rotation_z=payload.rotation_z,
        scale_x=payload.scale_x,
        scale_y=payload.scale_y,
        scale_z=payload.scale_z,
        status=payload.status,
        metadata_json=_json_dump(payload.metadata),
    )
    db.add(placement)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid object placement") from exc
    db.refresh(placement)
    return _placement_to_read(placement)


@router.put(
    "/buildings/{building_id}/object-placements/sync",
    response_model=list[ObjectPlacementRead],
)
def sync_object_placements(
    building_id: int,
    payload: ObjectPlacementSyncPayload,
    db: Session = Depends(get_db),
) -> list[ObjectPlacementRead]:
    _get_building_or_404(db, building_id)
    _validate_floor_scope(db, building_id, payload.floor_id)
    for placement_payload in payload.placements:
        _validate_floor_scope(db, building_id, placement_payload.floor_id)
        _validate_project_asset_scope(db, building_id, placement_payload.source_asset_id)

    existing_query = select(ObjectPlacement).where(ObjectPlacement.building_id == building_id)
    if payload.floor_id is not None:
        existing_query = existing_query.where(ObjectPlacement.floor_id == payload.floor_id)
    existing = db.scalars(existing_query)
    for placement in existing:
        metadata = _json_load(placement.metadata_json) or {}
        if metadata.get(payload.metadata_scope_key) == payload.metadata_scope_value:
            db.delete(placement)

    synced: list[ObjectPlacement] = []
    for placement_payload in payload.placements:
        placement = ObjectPlacement(
            building_id=building_id,
            floor_id=placement_payload.floor_id,
            source_asset_id=placement_payload.source_asset_id,
            object_type=placement_payload.object_type,
            name=placement_payload.name,
            position_x=placement_payload.position_x,
            position_y=placement_payload.position_y,
            position_z=placement_payload.position_z,
            rotation_x=placement_payload.rotation_x,
            rotation_y=placement_payload.rotation_y,
            rotation_z=placement_payload.rotation_z,
            scale_x=placement_payload.scale_x,
            scale_y=placement_payload.scale_y,
            scale_z=placement_payload.scale_z,
            status=placement_payload.status,
            metadata_json=_json_dump(placement_payload.metadata),
        )
        db.add(placement)
        synced.append(placement)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid object placement sync") from exc
    for placement in synced:
        db.refresh(placement)
    return [_placement_to_read(placement) for placement in synced]


@router.patch("/object-placements/{placement_id}", response_model=ObjectPlacementRead)
def update_object_placement(
    placement_id: int,
    payload: ObjectPlacementUpdate,
    db: Session = Depends(get_db),
) -> ObjectPlacementRead:
    placement = db.get(ObjectPlacement, placement_id)
    if placement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object placement not found")
    data = payload.model_dump(exclude_unset=True)
    if "floor_id" in data:
        _validate_floor_scope(db, placement.building_id, data["floor_id"])
    if "source_asset_id" in data:
        _validate_project_asset_scope(db, placement.building_id, data["source_asset_id"])
    for field, value in data.items():
        if field == "metadata":
            placement.metadata_json = _json_dump(value)
        else:
            setattr(placement, field, value)
    db.commit()
    db.refresh(placement)
    return _placement_to_read(placement)


@router.delete("/object-placements/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_object_placement(placement_id: int, db: Session = Depends(get_db)) -> None:
    placement = db.get(ObjectPlacement, placement_id)
    if placement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object placement not found")
    db.delete(placement)
    db.commit()


def _get_building_or_404(db: Session, building_id: int) -> Building:
    building = db.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    return building


def _building_floors(db: Session, building_id: int) -> list[Floor]:
    return list(db.scalars(select(Floor).where(Floor.building_id == building_id).order_by(Floor.floor_number)))


def _devices_for_floors(db: Session, floor_ids: list[int]) -> list[SecurityDevice]:
    if not floor_ids:
        return []
    return list(
        db.scalars(select(SecurityDevice).where(SecurityDevice.floor_id.in_(floor_ids)).order_by(SecurityDevice.id.desc()))
    )


def _count_by_floor_ids(db: Session, model: type[Wall] | type[Room], floor_ids: list[int]) -> int:
    if not floor_ids:
        return 0
    return int(db.scalar(select(func.count()).select_from(model).where(model.floor_id.in_(floor_ids))) or 0)


def _editor_device_count(placements: list[ObjectPlacement]) -> int:
    count = 0
    for placement in placements:
        metadata = _json_load(placement.metadata_json) or {}
        if placement.object_type == "security_device" or metadata.get("editor_source") == "editor-device":
            count += 1
    return count


def _alignment_applied(alignment: Any | None) -> bool:
    if not isinstance(alignment, dict):
        return False
    return bool(alignment.get("hasJustAligned") or alignment.get("alignmentMatrix"))


def _anchor_count(alignment: Any | None) -> int:
    if not isinstance(alignment, dict):
        return 0
    points = alignment.get("alignLocalPoints")
    if not isinstance(points, dict):
        return 0
    return sum(1 for point in points.values() if isinstance(point, dict) and isinstance(point.get("x"), (int, float)) and isinstance(point.get("y"), (int, float)))


def _validate_floor_scope(db: Session, building_id: int, floor_id: int | None) -> None:
    if floor_id is None:
        return
    floor = db.get(Floor, floor_id)
    if floor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")
    if floor.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Floor does not belong to building")


def _validate_upload_scope(db: Session, building_id: int, upload_asset_id: int | None) -> None:
    if upload_asset_id is None:
        return
    upload = db.get(UploadAsset, upload_asset_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload asset not found")
    if upload.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload asset does not belong to building")


def _validate_project_asset_scope(db: Session, building_id: int, asset_id: int | None) -> None:
    if asset_id is None:
        return
    asset = db.get(ProjectAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project asset not found")
    if asset.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project asset does not belong to building")


def _json_dump(value: Any | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _json_load(value: str | None) -> Any | None:
    if value is None:
        return None
    return json.loads(value)


def _asset_to_read(asset: ProjectAsset) -> ProjectAssetRead:
    return ProjectAssetRead(
        id=asset.id,
        building_id=asset.building_id,
        floor_id=asset.floor_id,
        upload_asset_id=asset.upload_asset_id,
        asset_type=asset.asset_type,
        name=asset.name,
        status=asset.status,
        file_uri=asset.file_uri,
        metadata=_json_load(asset.metadata_json),
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def _placement_to_read(placement: ObjectPlacement) -> ObjectPlacementRead:
    return ObjectPlacementRead(
        id=placement.id,
        building_id=placement.building_id,
        floor_id=placement.floor_id,
        source_asset_id=placement.source_asset_id,
        object_type=placement.object_type,
        name=placement.name,
        position_x=placement.position_x,
        position_y=placement.position_y,
        position_z=placement.position_z,
        rotation_x=placement.rotation_x,
        rotation_y=placement.rotation_y,
        rotation_z=placement.rotation_z,
        scale_x=placement.scale_x,
        scale_y=placement.scale_y,
        scale_z=placement.scale_z,
        status=placement.status,
        metadata=_json_load(placement.metadata_json),
        created_at=placement.created_at,
        updated_at=placement.updated_at,
    )
