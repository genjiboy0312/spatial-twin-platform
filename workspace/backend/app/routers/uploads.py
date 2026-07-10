import mmap
import json
import struct
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, Floor, ProjectAsset, UploadAsset
from app.schemas import ProjectAssetRead, UploadAssetCreate, UploadAssetRead, UploadAssetStatusUpdate, UploadPipelineRead
from app.settings import get_settings

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_SOURCE_TYPES = {"dxf", "dwg", "image", "ifc", "glb", "pointcloud", "unknown"}
POINTCLOUD_EXTENSIONS = {".las", ".laz", ".ply"}
READY_SOURCE_TYPES = {"image", "dxf", "dwg", "ifc", "glb", "pointcloud"}
PIPELINE_PROGRESS = {
    "queued": 5,
    "pending": 10,
    "uploaded": 25,
    "validating": 38,
    "processing": 52,
    "converting": 68,
    "preview_ready": 82,
    "ready": 100,
    "failed": 100,
}

SOURCE_PIPELINE_GUIDES = {
    "image": {
        "stage_label": "Image preview",
        "derived_outputs": ["thumbnail", "floor-plan preview", "scale metadata"],
        "supported_formats": ["PNG", "JPG", "JPEG"],
    },
    "dxf": {
        "stage_label": "CAD conversion",
        "derived_outputs": ["layer summary", "unit scale metadata", "geometry extraction queue"],
        "supported_formats": ["DXF", "DWG"],
    },
    "dwg": {
        "stage_label": "CAD conversion",
        "derived_outputs": ["layer summary", "unit scale metadata", "DXF conversion queue"],
        "supported_formats": ["DWG", "DXF"],
    },
    "ifc": {
        "stage_label": "BIM extraction",
        "derived_outputs": ["floor separation metadata", "space/object extraction queue", "model preview"],
        "supported_formats": ["IFC"],
    },
    "glb": {
        "stage_label": "3D model preview",
        "derived_outputs": ["scene bounds", "material/texture manifest", "render transform metadata"],
        "supported_formats": ["GLB", "GLTF"],
    },
    "pointcloud": {
        "stage_label": "PointCloud preview",
        "derived_outputs": ["LAS/PLY preview", "point-count header", "RGB availability", "editor render reference"],
        "supported_formats": ["LAS", "LAZ", "PLY"],
    },
    "unknown": {
        "stage_label": "Manual review",
        "derived_outputs": ["source registration"],
        "supported_formats": [],
    },
}


def metadata_for_upload(upload: UploadAsset, *, stored_name: str | None = None, size_bytes: int | None = None) -> str:
    pipeline = pipeline_details_for_upload(upload, stored_name=stored_name, size_bytes=size_bytes)
    metadata: dict[str, object] = {
        "source_type": upload.source_type,
        "pipeline_status": upload.status,
        "pipeline_stage": pipeline["current_stage"],
        "pipeline_progress": pipeline["progress"],
        "derived_outputs": pipeline["derived_outputs"],
        "supported_formats": pipeline["supported_formats"],
    }
    if stored_name is not None:
        metadata["stored_name"] = stored_name
    if size_bytes is not None:
        metadata["size_bytes"] = size_bytes
    return json.dumps(metadata, ensure_ascii=False)


def pipeline_details_for_upload(
    upload: UploadAsset,
    *,
    stored_name: str | None = None,
    size_bytes: int | None = None,
) -> dict[str, object]:
    guide = SOURCE_PIPELINE_GUIDES.get(upload.source_type, SOURCE_PIPELINE_GUIDES["unknown"])
    current_stage = "failed" if upload.status == "failed" else str(guide["stage_label"])
    progress = PIPELINE_PROGRESS.get(upload.status, 20)
    details: dict[str, object] = {
        "current_stage": current_stage,
        "progress": progress,
        "source_type": upload.source_type,
        "status": upload.status,
        "supported_formats": guide["supported_formats"],
        "derived_outputs": guide["derived_outputs"],
        "has_preview": upload.source_type in READY_SOURCE_TYPES and upload.status in {"preview_ready", "ready"},
        "failure_reason": upload.message if upload.status == "failed" else None,
    }
    if stored_name is not None:
        details["stored_name"] = stored_name
    if size_bytes is not None:
        details["size_bytes"] = size_bytes
    if upload.source_type == "pointcloud":
        details["max_render_points"] = 2_000_000
        details["rgb_supported"] = True
        details["preview_url"] = upload.pointcloud_preview_url
    elif upload.source_type == "image":
        details["thumbnail_status"] = "planned"
    elif upload.source_type in {"dxf", "dwg"}:
        details["cad_layers_status"] = "queued"
    elif upload.source_type == "ifc":
        details["floor_extraction_status"] = "queued"
    elif upload.source_type == "glb":
        details["scene_preview_status"] = "ready" if upload.status == "ready" else "queued"
    return details


def project_asset_to_read(asset: ProjectAsset) -> ProjectAssetRead:
    metadata = json.loads(asset.metadata_json) if asset.metadata_json else None
    return ProjectAssetRead(
        id=asset.id,
        building_id=asset.building_id,
        floor_id=asset.floor_id,
        upload_asset_id=asset.upload_asset_id,
        asset_type=asset.asset_type,
        name=asset.name,
        status=asset.status,
        file_uri=asset.file_uri,
        metadata=metadata,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def stored_filename_from_message(message: str | None) -> str | None:
    if not message:
        return None
    marker = " from " if " from " in message else " at "
    if marker not in message:
        return None
    return message.split(marker, 1)[1].split(" ", 1)[0].strip() or None


def upload_file_path(upload: UploadAsset, upload_dir: Path) -> Path:
    stored_name = stored_filename_from_message(upload.message)
    if stored_name is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload file is not available")

    file_path = (upload_dir / stored_name).resolve()
    resolved_upload_dir = upload_dir.resolve()
    if resolved_upload_dir not in file_path.parents or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload file is not available")
    return file_path


def delete_upload_files(upload: UploadAsset, upload_dir: Path) -> None:
    try:
        file_path = upload_file_path(upload, upload_dir)
    except HTTPException:
        return

    upload_dir_resolved = upload_dir.resolve()
    for cache_path in file_path.parent.glob(f"{file_path.name}.preview-*.bin"):
        resolved_cache = cache_path.resolve()
        if upload_dir_resolved in resolved_cache.parents:
            resolved_cache.unlink(missing_ok=True)
    file_path.unlink(missing_ok=True)


def project_asset_status_for_upload(status_value: str) -> str:
    if status_value == "ready":
        return "ready"
    if status_value == "failed":
        return "failed"
    if status_value in {"validating", "processing", "converting", "preview_ready"}:
        return "processing"
    return "registered"


def ensure_project_asset_for_upload(db: Session, upload: UploadAsset) -> ProjectAsset | None:
    if upload.building_id is None or upload.source_type not in READY_SOURCE_TYPES:
        return None
    stored_name = stored_filename_from_message(upload.message)
    size_bytes: int | None = None
    if upload.message and "(" in upload.message and " bytes)" in upload.message:
        size_part = upload.message.rsplit("(", 1)[-1].split(" bytes)", 1)[0]
        if size_part.isdigit():
            size_bytes = int(size_part)
    existing = db.scalar(select(ProjectAsset).where(ProjectAsset.upload_asset_id == upload.id))
    if existing is not None:
        existing.floor_id = upload.floor_id
        existing.asset_type = upload.source_type
        existing.name = upload.filename
        existing.status = project_asset_status_for_upload(upload.status)
        existing.file_uri = upload.file_url
        existing.metadata_json = metadata_for_upload(upload, stored_name=stored_name, size_bytes=size_bytes)
        return existing

    asset = ProjectAsset(
        building_id=upload.building_id,
        floor_id=upload.floor_id,
        upload_asset_id=upload.id,
        asset_type=upload.source_type,
        name=upload.filename,
        status=project_asset_status_for_upload(upload.status),
        file_uri=upload.file_url,
        metadata_json=metadata_for_upload(upload, stored_name=stored_name, size_bytes=size_bytes),
    )
    db.add(asset)
    return asset


def upload_next_actions(upload: UploadAsset) -> list[str]:
    if upload.status in {"queued", "pending"}:
        return ["Upload source file or attach an existing file", "Move status to processing when conversion starts"]
    if upload.status == "uploaded":
        return ["Validate source file", "Start source-specific processing"]
    if upload.status == "validating":
        return ["Check format compatibility", "Extract source metadata"]
    if upload.status in {"processing", "converting"}:
        return ["Poll pipeline status", "Create preview or derived model asset"]
    if upload.status == "preview_ready":
        return ["Review generated preview", "Promote source to ready when accepted"]
    if upload.status == "ready":
        return ["Load asset in editor/model pages", "Persist placement or alignment state"]
    if upload.status == "failed":
        return ["Show failure message", "Allow retry or replacement upload"]
    return ["Review upload state"]


def las_rgb_offset(point_format: int, point_record_length: int) -> int | None:
    if point_format == 2 and point_record_length >= 26:
        return 20
    if point_format in {3, 5} and point_record_length >= 34:
        return 28
    if point_format in {7, 8, 10} and point_record_length >= 36:
        return 30
    return None


def normalize_color(value: int) -> float:
    return max(0.0, min(1.0, value / 65535 if value > 255 else value / 255))


def las_sample_index(sample_index: int, sample_count: int, point_count: int) -> int:
    if sample_count <= 1:
        return 0
    return sample_index * (point_count - 1) // (sample_count - 1)


def las_preview_bytes(file_path: Path, max_points: int) -> tuple[bytes, int, str]:
    cache_path = file_path.with_suffix(f"{file_path.suffix}.preview-rgb-v3-{max_points}.bin")
    if cache_path.exists() and cache_path.stat().st_mtime >= file_path.stat().st_mtime:
        payload = cache_path.read_bytes()
        return payload, len(payload) // 24, "float32-xyzrgb"

    with file_path.open("rb") as file:
        if file.read(4) != b"LASF":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported LAS file")
        file.seek(96)
        point_data_offset = struct.unpack("<I", file.read(4))[0]
        file.seek(104)
        point_format = struct.unpack("<B", file.read(1))[0] & 0b0011_1111
        file.seek(105)
        point_record_length = struct.unpack("<H", file.read(2))[0]
        legacy_count = struct.unpack("<I", file.read(4))[0]
        file.seek(131)
        scale_x, scale_y, scale_z = struct.unpack("<ddd", file.read(24))
        offset_x, offset_y, offset_z = struct.unpack("<ddd", file.read(24))
        point_count = legacy_count
        if point_count == 0:
            file.seek(247)
            point_count = struct.unpack("<Q", file.read(8))[0]
        if point_data_offset <= 0 or point_record_length <= 0 or point_count <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid LAS point header")

        sample_count = min(max_points, point_count)
        color_offset = las_rgb_offset(point_format, point_record_length)
        min_x = min_y = min_z = float("inf")
        max_x = max_y = max_z = float("-inf")
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as mapped_file:
            valid_count = 0
            for sample in range(sample_count):
                index = las_sample_index(sample, sample_count, point_count)
                offset = point_data_offset + index * point_record_length
                if offset + point_record_length > len(mapped_file):
                    break
                ix, iy, iz = struct.unpack_from("<iii", mapped_file, offset)
                x = ix * scale_x + offset_x
                y = iy * scale_y + offset_y
                z = iz * scale_z + offset_z
                valid_count += 1
                min_x, min_y, min_z = min(min_x, x), min(min_y, y), min(min_z, z)
                max_x, max_y, max_z = max(max_x, x), max(max_y, y), max(max_z, z)

            if valid_count == 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No LAS points found")

            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            center_z = (min_z + max_z) / 2
            span = max(max_x - min_x, max_y - min_y, max_z - min_z, 1)
            scale = 12 / span
            payload = bytearray(valid_count * 24)
            payload_offset = 0
            packed_count = 0
            for sample in range(valid_count):
                index = las_sample_index(sample, sample_count, point_count)
                offset = point_data_offset + index * point_record_length
                if offset + point_record_length > len(mapped_file):
                    break
                ix, iy, iz = struct.unpack_from("<iii", mapped_file, offset)
                x = ix * scale_x + offset_x
                y = iy * scale_y + offset_y
                z = iz * scale_z + offset_z
                red = green = blue = None
                if color_offset is not None and color_offset + 6 <= point_record_length:
                    red_i, green_i, blue_i = struct.unpack_from("<HHH", mapped_file, offset + color_offset)
                    red = normalize_color(red_i)
                    green = normalize_color(green_i)
                    blue = normalize_color(blue_i)
                height_tone = max(0.25, min(1.0, (z - min_z) / max(max_z - min_z, 1)))
                struct.pack_into(
                    "<ffffff",
                    payload,
                    payload_offset,
                    (x - center_x) * scale,
                    (z - center_z) * scale,
                    (y - center_y) * scale,
                    red if red is not None else 0.18,
                    green if green is not None else 0.45 + height_tone * 0.45,
                    blue if blue is not None else 0.95,
                )
                payload_offset += 24
                packed_count += 1

    if valid_count == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No LAS points found")
    cache_path.write_bytes(payload)
    return bytes(payload), valid_count, "float32-xyzrgb"


@router.get("", response_model=list[UploadAssetRead])
def list_uploads(db: Session = Depends(get_db)) -> list[UploadAsset]:
    return list(db.scalars(select(UploadAsset).order_by(UploadAsset.id.desc())))


@router.get("/by-building/{building_id}", response_model=list[UploadAssetRead])
def list_uploads_by_building(building_id: int, db: Session = Depends(get_db)) -> list[UploadAsset]:
    return list(db.scalars(
        select(UploadAsset).where(UploadAsset.building_id == building_id).order_by(UploadAsset.id.desc())
    ))


@router.post("", response_model=UploadAssetRead, status_code=status.HTTP_201_CREATED)
def create_upload(payload: UploadAssetCreate, db: Session = Depends(get_db)) -> UploadAsset:
    if payload.building_id is not None and db.get(Building, payload.building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    floor: Floor | None = None
    if payload.floor_id is not None:
        floor = db.get(Floor, payload.floor_id)
        if floor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")

    if payload.building_id is not None and floor is not None and floor.building_id != payload.building_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Floor does not belong to building")

    upload = UploadAsset(**payload.model_dump(), status="pending", message="Metadata registered; waiting for file processing")
    db.add(upload)
    try:
        db.flush()
        ensure_project_asset_for_upload(db, upload)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload reference") from exc
    db.refresh(upload)
    return upload


@router.post("/file", response_model=UploadAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    source_type: str = Form(...),
    building_id: int | None = Form(None),
    floor_id: int | None = Form(None),
    db: Session = Depends(get_db),
) -> UploadAsset:
    settings = get_settings()

    if source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported source type")

    if building_id is not None and db.get(Building, building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    floor: Floor | None = None
    if floor_id is not None:
        floor = db.get(Floor, floor_id)
        if floor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")
        if building_id is not None and floor.building_id != building_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Floor does not belong to building")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "unknown").suffix if file.filename else ""
    if source_type == "pointcloud" and ext.lower() not in POINTCLOUD_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported pointcloud file type")

    unique_name = f"{uuid4().hex}{ext}"
    file_path = upload_dir / unique_name

    content = await file.read()
    file_path.write_bytes(content)
    status_value = "ready" if source_type in READY_SOURCE_TYPES else "uploaded"
    message = (
        f"PointCloud object ready from {file_path.name} ({len(content)} bytes)"
        if source_type == "pointcloud"
        else f"{source_type.upper()} source ready at {file_path.name} ({len(content)} bytes)"
    )

    upload = UploadAsset(
        filename=file.filename or unique_name,
        source_type=source_type,
        building_id=building_id,
        floor_id=floor_id,
        status=status_value,
        message=message,
    )
    db.add(upload)
    try:
        db.flush()
        ensure_project_asset_for_upload(db, upload)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload reference") from exc
    db.refresh(upload)
    return upload


@router.get("/{upload_id}/pipeline", response_model=UploadPipelineRead)
def get_upload_pipeline(upload_id: int, db: Session = Depends(get_db)) -> UploadPipelineRead:
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    assets = list(db.scalars(select(ProjectAsset).where(ProjectAsset.upload_asset_id == upload.id).order_by(ProjectAsset.id.desc())))
    details = pipeline_details_for_upload(upload)
    return UploadPipelineRead(
        upload=UploadAssetRead.model_validate(upload),
        project_assets=[project_asset_to_read(asset) for asset in assets],
        next_actions=upload_next_actions(upload),
        current_stage=str(details["current_stage"]),
        progress=int(details["progress"]),
        details=details,
    )


@router.patch("/{upload_id}/status", response_model=UploadPipelineRead)
def update_upload_status(
    upload_id: int,
    payload: UploadAssetStatusUpdate,
    db: Session = Depends(get_db),
) -> UploadPipelineRead:
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    upload.status = payload.status
    if payload.message is not None:
        upload.message = payload.message
    ensure_project_asset_for_upload(db, upload)
    db.commit()
    db.refresh(upload)
    assets = list(db.scalars(select(ProjectAsset).where(ProjectAsset.upload_asset_id == upload.id).order_by(ProjectAsset.id.desc())))
    details = pipeline_details_for_upload(upload)
    return UploadPipelineRead(
        upload=UploadAssetRead.model_validate(upload),
        project_assets=[project_asset_to_read(asset) for asset in assets],
        next_actions=upload_next_actions(upload),
        current_stage=str(details["current_stage"]),
        progress=int(details["progress"]),
        details=details,
    )


@router.get("/{upload_id}/file")
def get_upload_file(upload_id: int, db: Session = Depends(get_db)) -> FileResponse:
    settings = get_settings()
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    file_path = upload_file_path(upload, Path(settings.upload_dir))
    return FileResponse(file_path, filename=upload.filename)


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(upload_id: int, db: Session = Depends(get_db)) -> None:
    settings = get_settings()
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    delete_upload_files(upload, Path(settings.upload_dir))
    for asset in db.scalars(select(ProjectAsset).where(ProjectAsset.upload_asset_id == upload.id)):
        db.delete(asset)
    db.delete(upload)
    db.commit()


@router.get("/{upload_id}/pointcloud-preview")
def get_pointcloud_preview(
    upload_id: int,
    max_points: int = 2_000_000,
    db: Session = Depends(get_db),
) -> Response:
    settings = get_settings()
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.source_type != "pointcloud":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload is not a pointcloud")

    file_path = upload_file_path(upload, Path(settings.upload_dir))
    if file_path.suffix.lower() != ".las":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Preview currently supports LAS files")
    payload, point_count, point_format = las_preview_bytes(file_path, max(1, min(max_points, 2_000_000)))
    return Response(
        content=payload,
        media_type="application/octet-stream",
        headers={"X-Point-Count": str(point_count), "X-Point-Format": point_format},
    )
