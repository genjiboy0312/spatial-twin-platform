import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, BuildingMapSettings, BuildingSpatialSettings, Floor, FloorSpatialSettings
from app.schemas import (
    BuildingCreate,
    BuildingMapSettingsPayload,
    BuildingMapSettingsRead,
    BuildingRead,
    BuildingUpdate,
    FloorCreate,
    FloorRead,
    SpatialSettingsPayload,
    SpatialSettingsRead,
)

router = APIRouter(prefix="/api", tags=["buildings"])


@router.get("/buildings", response_model=list[BuildingRead])
def list_buildings(db: Session = Depends(get_db)) -> list[Building]:
    return list(db.scalars(select(Building).order_by(Building.id)))


@router.post("/buildings", response_model=BuildingRead, status_code=status.HTTP_201_CREATED)
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)) -> Building:
    building = Building(**payload.model_dump())
    db.add(building)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Building already exists") from exc
    db.refresh(building)
    return building


@router.get("/buildings/{building_id}", response_model=BuildingRead)
def get_building(building_id: int, db: Session = Depends(get_db)) -> Building:
    building = db.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    return building


@router.patch("/buildings/{building_id}", response_model=BuildingRead)
def update_building(building_id: int, payload: BuildingUpdate, db: Session = Depends(get_db)) -> Building:
    building = db.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(building, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Building already exists") from exc
    db.refresh(building)
    return building


@router.get("/buildings/{building_id}/map-settings", response_model=BuildingMapSettingsRead)
def get_building_map_settings(building_id: int, db: Session = Depends(get_db)) -> BuildingMapSettingsRead:
    building = _get_building_or_404(db, building_id)
    settings = db.scalar(select(BuildingMapSettings).where(BuildingMapSettings.building_id == building_id))
    if settings is None:
        return BuildingMapSettingsRead(
            building_id=building_id,
            origin_latitude=building.origin_latitude or 37.5665,
            origin_longitude=building.origin_longitude or 126.9784,
            osm_zoom=16,
            osm_scale=2.0,
            osm_opacity=0.72,
            saved=False,
        )
    return BuildingMapSettingsRead(
        building_id=settings.building_id,
        origin_latitude=settings.origin_latitude,
        origin_longitude=settings.origin_longitude,
        osm_zoom=settings.osm_zoom,
        osm_scale=settings.osm_scale,
        osm_opacity=settings.osm_opacity,
        saved=True,
        updated_at=settings.updated_at,
    )


@router.put("/buildings/{building_id}/map-settings", response_model=BuildingMapSettingsRead)
def upsert_building_map_settings(
    building_id: int,
    payload: BuildingMapSettingsPayload,
    db: Session = Depends(get_db),
) -> BuildingMapSettingsRead:
    building = _get_building_or_404(db, building_id)
    settings = db.scalar(select(BuildingMapSettings).where(BuildingMapSettings.building_id == building_id))
    if settings is None:
        settings = BuildingMapSettings(building_id=building_id)
        db.add(settings)
    for field, value in payload.model_dump().items():
        setattr(settings, field, value)
    building.origin_latitude = payload.origin_latitude
    building.origin_longitude = payload.origin_longitude
    db.commit()
    db.refresh(settings)
    return BuildingMapSettingsRead(
        building_id=settings.building_id,
        origin_latitude=settings.origin_latitude,
        origin_longitude=settings.origin_longitude,
        osm_zoom=settings.osm_zoom,
        osm_scale=settings.osm_scale,
        osm_opacity=settings.osm_opacity,
        saved=True,
        updated_at=settings.updated_at,
    )


@router.get("/buildings/{building_id}/floors", response_model=list[FloorRead])
def list_floors(building_id: int, db: Session = Depends(get_db)) -> list[Floor]:
    return list(db.scalars(select(Floor).where(Floor.building_id == building_id).order_by(Floor.floor_number)))


@router.post("/buildings/{building_id}/floors", response_model=FloorRead, status_code=status.HTTP_201_CREATED)
def create_floor(building_id: int, payload: FloorCreate, db: Session = Depends(get_db)) -> Floor:
    if db.get(Building, building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    floor = Floor(building_id=building_id, **payload.model_dump())
    db.add(floor)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Floor already exists") from exc
    db.refresh(floor)
    return floor


@router.get("/buildings/{building_id}/spatial-settings", response_model=SpatialSettingsRead)
def get_building_spatial_settings(building_id: int, db: Session = Depends(get_db)) -> SpatialSettingsRead:
    _get_building_or_404(db, building_id)
    settings = db.scalar(select(BuildingSpatialSettings).where(BuildingSpatialSettings.building_id == building_id))
    if settings is None:
        return SpatialSettingsRead(building_id=building_id, apply_to_building=True, saved=False)
    return _building_spatial_to_read(settings, saved=True)


@router.put("/buildings/{building_id}/spatial-settings", response_model=SpatialSettingsRead)
def upsert_building_spatial_settings(
    building_id: int,
    payload: SpatialSettingsPayload,
    db: Session = Depends(get_db),
) -> SpatialSettingsRead:
    _get_building_or_404(db, building_id)
    settings = db.scalar(select(BuildingSpatialSettings).where(BuildingSpatialSettings.building_id == building_id))
    if settings is None:
        settings = BuildingSpatialSettings(building_id=building_id)
        db.add(settings)
    _apply_spatial_payload(settings, payload, allow_scope=True)
    db.commit()
    db.refresh(settings)
    return _building_spatial_to_read(settings, saved=True)


@router.get("/floors/{floor_id}/spatial-settings", response_model=SpatialSettingsRead)
def get_floor_spatial_settings(floor_id: int, db: Session = Depends(get_db)) -> SpatialSettingsRead:
    _get_floor_or_404(db, floor_id)
    settings = db.scalar(select(FloorSpatialSettings).where(FloorSpatialSettings.floor_id == floor_id))
    if settings is None:
        return SpatialSettingsRead(floor_id=floor_id, saved=False)
    return _floor_spatial_to_read(settings, saved=True)


@router.put("/floors/{floor_id}/spatial-settings", response_model=SpatialSettingsRead)
def upsert_floor_spatial_settings(
    floor_id: int,
    payload: SpatialSettingsPayload,
    db: Session = Depends(get_db),
) -> SpatialSettingsRead:
    _get_floor_or_404(db, floor_id)
    settings = db.scalar(select(FloorSpatialSettings).where(FloorSpatialSettings.floor_id == floor_id))
    if settings is None:
        settings = FloorSpatialSettings(floor_id=floor_id)
        db.add(settings)
    _apply_spatial_payload(settings, payload, allow_scope=False)
    db.commit()
    db.refresh(settings)
    return _floor_spatial_to_read(settings, saved=True)


def _get_building_or_404(db: Session, building_id: int) -> Building:
    building = db.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    return building


def _get_floor_or_404(db: Session, floor_id: int) -> Floor:
    floor = db.get(Floor, floor_id)
    if floor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")
    return floor


def _json_dump(value: Any | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _json_load(value: str | None) -> Any | None:
    if value is None:
        return None
    return json.loads(value)


def _apply_spatial_payload(
    settings: BuildingSpatialSettings | FloorSpatialSettings,
    payload: SpatialSettingsPayload,
    *,
    allow_scope: bool,
) -> None:
    data = payload.model_dump(exclude_unset=True)
    if allow_scope and "apply_to_building" in data and isinstance(settings, BuildingSpatialSettings):
        settings.apply_to_building = bool(data["apply_to_building"])
    for field in (
        "alignment_local_points",
        "alignment_gps_points",
        "glb_transform",
        "alignment_transform_matrix",
    ):
        if field in data:
            setattr(settings, field, _json_dump(data[field]))
    if "render_model_format" in data:
        settings.render_model_format = data["render_model_format"]
    if "alignment_rmse" in data:
        settings.alignment_rmse = data["alignment_rmse"]


def _building_spatial_to_read(settings: BuildingSpatialSettings, *, saved: bool) -> SpatialSettingsRead:
    return SpatialSettingsRead(
        building_id=settings.building_id,
        apply_to_building=settings.apply_to_building,
        alignment_local_points=_json_load(settings.alignment_local_points),
        alignment_gps_points=_json_load(settings.alignment_gps_points),
        glb_transform=_json_load(settings.glb_transform),
        render_model_format=settings.render_model_format,
        alignment_transform_matrix=_json_load(settings.alignment_transform_matrix),
        alignment_rmse=settings.alignment_rmse,
        saved=saved,
        updated_at=settings.updated_at,
    )


def _floor_spatial_to_read(settings: FloorSpatialSettings, *, saved: bool) -> SpatialSettingsRead:
    return SpatialSettingsRead(
        floor_id=settings.floor_id,
        alignment_local_points=_json_load(settings.alignment_local_points),
        alignment_gps_points=_json_load(settings.alignment_gps_points),
        glb_transform=_json_load(settings.glb_transform),
        render_model_format=settings.render_model_format,
        alignment_transform_matrix=_json_load(settings.alignment_transform_matrix),
        alignment_rmse=settings.alignment_rmse,
        saved=saved,
        updated_at=settings.updated_at,
    )
