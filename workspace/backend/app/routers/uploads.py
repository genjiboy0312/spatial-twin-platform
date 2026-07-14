import json
import logging
import mmap
import struct
from pathlib import Path
from threading import Lock
from typing import cast
from urllib.parse import unquote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, Floor, ProjectAsset, Room, UploadAsset, Wall
from app.schemas import AssetType, ProjectAssetRead, UploadAssetCreate, UploadAssetRead, UploadAssetStatusUpdate, UploadPipelineRead
from app.services.dxf_parser import DxfParseResult, DxfRoom, parse_dxf_file
from app.services.pointcloud_mesh import build_surface_glb
from app.settings import get_settings

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
logger = logging.getLogger(__name__)
pointcloud_mesh_progress: dict[int, dict[str, int | str | bool]] = {}
pointcloud_mesh_progress_lock = Lock()


def set_pointcloud_mesh_progress(upload_id: int, percent: int, stage: str, active: bool = True) -> None:
    with pointcloud_mesh_progress_lock:
        pointcloud_mesh_progress[upload_id] = {
            "upload_id": upload_id,
            "percent": max(0, min(100, percent)),
            "stage": stage,
            "active": active,
        }

ALLOWED_SOURCE_TYPES = {"dxf", "dwg", "image", "ifc", "glb", "pointcloud", "unknown"}
SOURCE_EXTENSIONS = {
    "image": {".png", ".jpg", ".jpeg"},
    "dxf": {".dxf", ".dwg"},
    "dwg": {".dwg", ".dxf"},
    "ifc": {".ifc"},
    "glb": {".glb", ".gltf"},
    "pointcloud": {".las", ".laz", ".ply"},
    "unknown": set(),
}
MODEL_PACKAGE_EXTENSIONS = {".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".webp"}
POINTCLOUD_EXTENSIONS = SOURCE_EXTENSIONS["pointcloud"]
READY_SOURCE_TYPES = {"image", "dxf", "dwg", "ifc", "glb", "pointcloud"}
UPLOAD_CHUNK_SIZE = 1024 * 1024
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


def metadata_for_upload(
    upload: UploadAsset,
    *,
    stored_name: str | None = None,
    size_bytes: int | None = None,
    extra: dict[str, object] | None = None,
) -> str:
    pipeline = pipeline_details_for_upload(upload, stored_name=stored_name, size_bytes=size_bytes)
    metadata: dict[str, object] = {
        "source_type": upload.source_type,
        "pipeline_status": upload.status,
        "pipeline_stage": pipeline["current_stage"],
        "pipeline_progress": pipeline["progress"],
        "derived_outputs": pipeline["derived_outputs"],
        "derivative_records": pipeline["derivative_records"],
        "supported_formats": pipeline["supported_formats"],
        "thumbnail_uri": pipeline["thumbnail_uri"],
    }
    if stored_name is not None:
        metadata["stored_name"] = stored_name
    if size_bytes is not None:
        metadata["size_bytes"] = size_bytes
    if upload.source_type == "pointcloud":
        metadata.update(pointcloud_metadata_for_upload(upload, stored_name=stored_name))
    if extra:
        metadata.update(extra)
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
        "derivative_records": derivative_records_for_upload(upload),
        "has_preview": upload.source_type in READY_SOURCE_TYPES and upload.status in {"preview_ready", "ready"},
        "failure_reason": upload.message if upload.status == "failed" else None,
        "thumbnail_uri": thumbnail_uri_for_upload(upload),
        "persistent_file_uri": upload.file_url,
    }
    if stored_name is not None:
        details["stored_name"] = stored_name
    if size_bytes is not None:
        details["size_bytes"] = size_bytes
    if upload.source_type == "pointcloud":
        pointcloud_metadata = pointcloud_metadata_for_upload(upload)
        details["max_render_points"] = 2_000_000
        details["rgb_supported"] = True
        details["preview_url"] = upload.pointcloud_preview_url
        details.update(pointcloud_metadata)
    elif upload.source_type == "image":
        details["thumbnail_status"] = "planned"
    elif upload.source_type in {"dxf", "dwg"}:
        details["cad_layers_status"] = "queued"
    elif upload.source_type == "ifc":
        details["floor_extraction_status"] = "queued"
    elif upload.source_type == "glb":
        details["scene_preview_status"] = "ready" if upload.status == "ready" else "queued"
    return details


def derivative_records_for_upload(upload: UploadAsset) -> list[dict[str, object]]:
    records: list[dict[str, object]] = [
        {"kind": "source", "status": upload.status, "uri": upload.file_url},
    ]
    if upload.source_type == "image":
        records.append({"kind": "thumbnail", "status": "ready" if upload.status == "ready" else "queued"})
    elif upload.source_type in {"dxf", "dwg"}:
        records.append({"kind": "geometry-extraction", "status": "queued"})
        records.append({"kind": "layer-summary", "status": "queued"})
    elif upload.source_type == "ifc":
        records.append({"kind": "floor-separation", "status": "queued"})
        records.append({"kind": "space-object-extraction", "status": "queued"})
    elif upload.source_type == "glb":
        records.append({"kind": "scene-bounds", "status": "ready" if upload.status == "ready" else "queued"})
    elif upload.source_type == "pointcloud":
        records.append({"kind": "pointcloud-preview", "status": "ready" if upload.status == "ready" else "queued", "uri": upload.pointcloud_preview_url})
    return records


def thumbnail_uri_for_upload(upload: UploadAsset) -> str | None:
    if upload.source_type in {"image", "glb", "ifc"} and upload.file_url is not None:
        return f"{upload.file_url}?preview=thumbnail"
    return None


def max_upload_bytes_for_source(source_type: str) -> int:
    settings = get_settings()
    if source_type == "image":
        return settings.upload_max_bytes_image
    if source_type in {"dxf", "dwg"}:
        return settings.upload_max_bytes_cad
    if source_type in {"ifc", "glb"}:
        return settings.upload_max_bytes_model
    if source_type == "pointcloud":
        return settings.upload_max_bytes_pointcloud
    return settings.upload_max_bytes_default


def validate_source_extension(source_type: str, filename: str | None) -> str:
    ext = Path(filename or "unknown").suffix.lower()
    allowed = SOURCE_EXTENSIONS.get(source_type, set())
    if allowed and ext not in allowed:
        allowed_list = ", ".join(sorted(allowed))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported {source_type} file type. Allowed: {allowed_list}",
        )
    return ext


def normalize_source_type_for_extension(source_type: str, ext: str) -> str:
    if source_type in {"dxf", "dwg"} and ext == ".dwg":
        return "dwg"
    if source_type in {"dxf", "dwg"} and ext == ".dxf":
        return "dxf"
    return source_type


async def write_upload_stream(file: UploadFile, file_path: Path, max_bytes: int) -> int:
    size_bytes = 0
    try:
        with file_path.open("wb") as target:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"Upload exceeds {max_bytes} byte limit",
                    )
                target.write(chunk)
    except Exception:
        file_path.unlink(missing_ok=True)
        raise
    return size_bytes


def validate_pointcloud_source(file_path: Path) -> dict[str, object]:
    ext = file_path.suffix.lower()
    if ext == ".las":
        with file_path.open("rb") as file:
            if file.read(4) != b"LASF":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid LAS pointcloud file")
            file.seek(104)
            point_format = struct.unpack("<B", file.read(1))[0] & 0b0011_1111
            point_record_length = struct.unpack("<H", file.read(2))[0]
            legacy_count = struct.unpack("<I", file.read(4))[0]
            point_count = legacy_count
            if point_count == 0:
                file.seek(247)
                point_count = struct.unpack("<Q", file.read(8))[0]
            if point_record_length <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid LAS point record")
            return {
                "pointcloud_format": "las",
                "point_format": point_format,
                "point_record_length": point_record_length,
                "source_point_count": int(point_count),
                "preview_supported": True,
                "rgb_supported": las_rgb_offset(point_format, point_record_length) is not None,
            }
    if ext == ".ply":
        with file_path.open("rb") as file:
            header = file.read(64_000).decode("utf-8", errors="ignore")
        if not header.startswith("ply") or "end_header" not in header:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid PLY pointcloud file")
        vertex_count = 0
        for line in header.splitlines():
            parts = line.strip().split()
            if len(parts) == 3 and parts[0] == "element" and parts[1] == "vertex":
                vertex_count = int(parts[2]) if parts[2].isdigit() else 0
                break
        return {
            "pointcloud_format": "ply",
            "source_point_count": vertex_count,
            "preview_supported": False,
            "rgb_supported": any(name in header for name in (" red", " green", " blue", " r", " g", " b")),
        }
    if ext == ".laz":
        return {
            "pointcloud_format": "laz",
            "source_point_count": None,
            "preview_supported": False,
            "rgb_supported": None,
        }
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported pointcloud file")


def pointcloud_metadata_for_upload(upload: UploadAsset, stored_name: str | None = None) -> dict[str, object]:
    if upload.source_type != "pointcloud":
        return {}
    stored = stored_name or stored_filename_from_message(upload.message)
    if stored is None:
        return {
            "pointcloud_format": None,
            "source_point_count": None,
            "preview_supported": False,
            "rgb_supported": None,
        }
    file_path = (Path(get_settings().upload_dir) / stored).resolve()
    upload_dir = Path(get_settings().upload_dir).resolve()
    if upload_dir not in file_path.parents or not file_path.exists():
        return {
            "pointcloud_format": None,
            "source_point_count": None,
            "preview_supported": False,
            "rgb_supported": None,
        }
    try:
        return validate_pointcloud_source(file_path)
    except HTTPException:
        return {
            "pointcloud_format": file_path.suffix.lower().lstrip(".") or None,
            "source_point_count": None,
            "preview_supported": False,
            "rgb_supported": None,
        }


def project_asset_to_read(asset: ProjectAsset) -> ProjectAssetRead:
    metadata = json.loads(asset.metadata_json) if asset.metadata_json else None
    return ProjectAssetRead(
        id=asset.id,
        building_id=asset.building_id,
        floor_id=asset.floor_id,
        upload_asset_id=asset.upload_asset_id,
        asset_type=cast(AssetType, asset.asset_type),
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
    file_path.with_suffix(f"{file_path.suffix}.mesh.glb").unlink(missing_ok=True)
    if file_path.parent != upload_dir_resolved and upload_dir_resolved in file_path.parent.parents:
        for package_file in file_path.parent.iterdir():
            if package_file.is_file():
                package_file.unlink(missing_ok=True)
        file_path.parent.rmdir()
        return
    file_path.unlink(missing_ok=True)


def replacement_source_types(source_type: str) -> set[str]:
    if source_type in {"dxf", "dwg"}:
        return {"dxf", "dwg"}
    if source_type in {"glb", "ifc", "image", "pointcloud"}:
        return {source_type}
    return {source_type}


def clear_cad_geometry_for_upload(db: Session, upload: UploadAsset) -> None:
    if upload.source_type not in {"dxf", "dwg"} or upload.floor_id is None:
        return

    for wall in db.scalars(select(Wall).where(Wall.floor_id == upload.floor_id)):
        db.delete(wall)
    for room in db.scalars(select(Room).where(Room.floor_id == upload.floor_id)):
        db.delete(room)


def delete_replaced_uploads(
    db: Session,
    *,
    upload_dir: Path,
    building_id: int | None,
    floor_id: int | None,
    source_type: str,
) -> None:
    if building_id is None:
        return

    existing_uploads = list(db.scalars(
        select(UploadAsset).where(
            UploadAsset.building_id == building_id,
            UploadAsset.floor_id == floor_id,
            UploadAsset.source_type.in_(replacement_source_types(source_type)),
        )
    ))
    for existing in existing_uploads:
        delete_upload_files(existing, upload_dir)
        for asset in db.scalars(select(ProjectAsset).where(ProjectAsset.upload_asset_id == existing.id)):
            db.delete(asset)
        clear_cad_geometry_for_upload(db, existing)
        db.delete(existing)


def project_asset_status_for_upload(status_value: str) -> str:
    if status_value == "ready":
        return "ready"
    if status_value == "failed":
        return "failed"
    if status_value in {"validating", "processing", "converting", "preview_ready"}:
        return "processing"
    return "registered"


def ensure_project_asset_for_upload(
    db: Session,
    upload: UploadAsset,
    *,
    extra_metadata: dict[str, object] | None = None,
) -> ProjectAsset | None:
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
        existing.metadata_json = metadata_for_upload(upload, stored_name=stored_name, size_bytes=size_bytes, extra=extra_metadata)
        return existing

    asset = ProjectAsset(
        building_id=upload.building_id,
        floor_id=upload.floor_id,
        upload_asset_id=upload.id,
        asset_type=upload.source_type,
        name=upload.filename,
        status=project_asset_status_for_upload(upload.status),
        file_uri=upload.file_url,
        metadata_json=metadata_for_upload(upload, stored_name=stored_name, size_bytes=size_bytes, extra=extra_metadata),
    )
    db.add(asset)
    return asset


def persist_dxf_geometry(
    db: Session,
    parse_result: DxfParseResult,
    *,
    floor_id: int | None,
    scale_factor: float | None = None,
    invert_y_axis: bool | None = None,
) -> dict[str, int | str]:
    if floor_id is None:
        return {"status": "skipped", "created_walls_count": 0, "created_rooms_count": 0, "reason": "No floor_id provided"}

    for wall in db.scalars(select(Wall).where(Wall.floor_id == floor_id)):
        db.delete(wall)
    for room in db.scalars(select(Room).where(Room.floor_id == floor_id)):
        db.delete(room)

    scale = scale_factor if scale_factor is not None and scale_factor > 0 else 1.0
    invert = bool(invert_y_axis)

    walls = [
        Wall(
            floor_id=floor_id,
            x1=segment.start[0] * scale,
            y1=(-segment.start[1] if invert else segment.start[1]) * scale,
            x2=segment.end[0] * scale,
            y2=(-segment.end[1] if invert else segment.end[1]) * scale,
        )
        for segment in parse_result.walls
    ]
    rooms = [
        Room(floor_id=floor_id, **_scaled_room_payload(room, scale=scale, invert_y_axis=invert))
        for room in parse_result.rooms
    ]
    db.add_all([*walls, *rooms])
    return {"status": "created", "created_walls_count": len(walls), "created_rooms_count": len(rooms)}


def _scaled_room_payload(room: DxfRoom, *, scale: float, invert_y_axis: bool) -> dict[str, object]:
    room_data = {
        "name": room.name,
        "x": room.x,
        "y": room.y,
        "w": room.w,
        "h": room.h,
    }
    x_values = [room_data["x"], room_data["x"] + room_data["w"]]
    y_values = [room_data["y"], room_data["y"] + room_data["h"]]
    if invert_y_axis:
        y_values = [-value for value in y_values]
    min_x = min(x_values) * scale
    max_x = max(x_values) * scale
    min_y = min(y_values) * scale
    max_y = max(y_values) * scale
    points = [
        {"x": point[0] * scale, "y": (-point[1] if invert_y_axis else point[1]) * scale}
        for point in room.points
    ]
    return {
        "name": str(room_data["name"]),
        "x": min_x,
        "y": min_y,
        "w": max_x - min_x,
        "h": max_y - min_y,
        "points_json": json.dumps(points),
    }


def safe_upload_name(filename: str | None) -> str:
    fallback = "upload.bin"
    name = Path(filename or fallback).name
    cleaned = "".join(ch if ch.isalnum() or ch in {".", "_", "-"} else "_" for ch in name)
    return cleaned or fallback


def model_package_refs(gltf_bytes: bytes) -> set[str]:
    try:
        payload = json.loads(gltf_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid GLTF file") from exc
    refs: set[str] = set()
    for item in payload.get("buffers", []):
        uri = item.get("uri") if isinstance(item, dict) else None
        if isinstance(uri, str) and not uri.startswith(("data:", "http://", "https://")):
            refs.add(Path(unquote(uri)).name.lower())
    for item in payload.get("images", []):
        uri = item.get("uri") if isinstance(item, dict) else None
        if isinstance(uri, str) and not uri.startswith(("data:", "http://", "https://")):
            refs.add(Path(unquote(uri)).name.lower())
    return refs


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

    if packed_count == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No LAS points found")
    packed_payload = bytes(payload[:packed_count * 24])
    cache_path.with_suffix(f"{cache_path.suffix}.tmp").write_bytes(packed_payload)
    cache_path.with_suffix(f"{cache_path.suffix}.tmp").replace(cache_path)
    return packed_payload, packed_count, "float32-xyzrgb"


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
    scale_factor: float | None = Form(None),
    height_meters: float | None = Form(None),
    scale_px_per_meter: float | None = Form(None),
    invert_y_axis: bool | None = Form(None),
    floor_level: int | None = Form(None),
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

    ext = validate_source_extension(source_type, file.filename)
    source_type = normalize_source_type_for_extension(source_type, ext)

    unique_name = f"{uuid4().hex}{ext}"
    file_path = upload_dir / unique_name

    max_bytes = max_upload_bytes_for_source(source_type)
    try:
        size_bytes = await write_upload_stream(file, file_path, max_bytes)
        if source_type == "pointcloud":
            validate_pointcloud_source(file_path)
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    status_value = "ready" if source_type in READY_SOURCE_TYPES else "uploaded"
    processing_metadata: dict[str, object] = {}
    if source_type in {"dxf", "dwg"}:
        processing_metadata["processing_options"] = {
            "scale_factor": scale_factor,
            "height_meters": height_meters,
            "invert_y_axis": invert_y_axis,
        }
    elif source_type == "image":
        processing_metadata["processing_options"] = {"scale_px_per_meter": scale_px_per_meter}
    elif source_type == "ifc":
        processing_metadata["processing_options"] = {"floor_level": floor_level}
    message = (
        f"PointCloud object ready from {file_path.name} ({size_bytes} bytes)"
        if source_type == "pointcloud"
        else f"{source_type.upper()} source ready at {file_path.name} ({size_bytes} bytes)"
    )

    upload = UploadAsset(
        filename=file.filename or unique_name,
        source_type=source_type,
        building_id=building_id,
        floor_id=floor_id,
        status=status_value,
        message=message,
    )
    try:
        delete_replaced_uploads(
            db,
            upload_dir=upload_dir,
            building_id=building_id,
            floor_id=floor_id,
            source_type=source_type,
        )
        db.add(upload)
        db.flush()
        if source_type in {"dxf", "dwg"}:
            try:
                parse_result = parse_dxf_file(file_path)
                parsed_geometry = parse_result.summary()
                parsed_geometry["persistence"] = persist_dxf_geometry(
                    db,
                    parse_result,
                    floor_id=floor_id,
                    scale_factor=scale_factor,
                    invert_y_axis=invert_y_axis,
                )
            except Exception as exc:
                logger.exception("CAD geometry parsing failed for upload %s", file_path)
                parsed_geometry = {
                    "status": "failed",
                    "error": str(exc),
                    "total_entities": 0,
                    "layers": [],
                    "entity_counts": {},
                    "walls_count": 0,
                    "rooms_count": 0,
                    "persistence": {"status": "skipped", "created_walls_count": 0, "created_rooms_count": 0},
                }
            processing_metadata["parsed_geometry"] = parsed_geometry
            setattr(upload, "parsed_geometry", parsed_geometry)
        ensure_project_asset_for_upload(db, upload, extra_metadata=processing_metadata)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload reference") from exc
    db.refresh(upload)
    return upload


@router.post("/model-package", response_model=UploadAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_model_package(
    files: list[UploadFile] = File(...),
    building_id: int | None = Form(None),
    floor_id: int | None = Form(None),
    db: Session = Depends(get_db),
) -> UploadAsset:
    settings = get_settings()
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one GLB or GLTF file must be included")

    if building_id is not None and db.get(Building, building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    floor: Floor | None = None
    if floor_id is not None:
        floor = db.get(Floor, floor_id)
        if floor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")
        if building_id is not None and floor.building_id != building_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Floor does not belong to building")

    named_files = [(safe_upload_name(file.filename), file) for file in files]
    lower_names = [name.lower() for name, _file in named_files]
    entry_candidates = [name for name in lower_names if name.endswith((".glb", ".gltf"))]
    if not entry_candidates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one GLB or GLTF file must be included")

    for name, _file in named_files:
        if Path(name).suffix.lower() not in MODEL_PACKAGE_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported model package file type: {Path(name).suffix.lower()}")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    package_id = uuid4().hex
    package_dir = upload_dir / package_id
    package_dir.mkdir(parents=True, exist_ok=True)

    entry_name = next((name for name in lower_names if name.endswith(".glb")), entry_candidates[0])
    stored_files: list[dict[str, object]] = []
    total_size = 0
    gltf_payloads: dict[str, bytes] = {}
    try:
        for original_name, upload_item in named_files:
            ext = Path(original_name).suffix.lower()
            stored_name = safe_upload_name(original_name)
            target = package_dir / stored_name
            size_bytes = await write_upload_stream(upload_item, target, settings.upload_max_bytes_model)
            total_size += size_bytes
            if ext == ".gltf":
                gltf_payloads[stored_name.lower()] = target.read_bytes()
            stored_files.append({
                "name": stored_name,
                "size_bytes": size_bytes,
                "role": "entry" if stored_name.lower() == entry_name else "resource",
            })

        uploaded_names = {item["name"].lower() for item in stored_files if isinstance(item["name"], str)}
        missing_refs: set[str] = set()
        for payload in gltf_payloads.values():
            missing_refs.update(ref for ref in model_package_refs(payload) if ref not in uploaded_names)
        if missing_refs:
            missing = ", ".join(sorted(missing_refs))
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"GLTF references missing files: {missing}")

        primary_stored_name = f"{package_id}/{entry_name}"
        upload = UploadAsset(
            filename=entry_name,
            source_type="glb",
            building_id=building_id,
            floor_id=floor_id,
            status="ready",
            message=f"GLB source ready at {primary_stored_name} ({total_size} bytes)",
        )
        try:
            delete_replaced_uploads(
                db,
                upload_dir=upload_dir,
                building_id=building_id,
                floor_id=floor_id,
                source_type="glb",
            )
            db.add(upload)
            db.flush()
            ensure_project_asset_for_upload(db, upload, extra_metadata={
                "package_id": package_id,
                "entry_file": entry_name,
                "files": stored_files,
                "package_kind": "glb" if entry_name.endswith(".glb") else "gltf",
            })
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload reference") from exc
    except HTTPException:
        for path in package_dir.glob("*"):
            path.unlink(missing_ok=True)
        package_dir.rmdir()
        raise
    except Exception as exc:
        for path in package_dir.glob("*"):
            path.unlink(missing_ok=True)
        package_dir.rmdir()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Model package upload failed: {exc}") from exc

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
        progress=int(cast(int, details["progress"])),
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
        progress=int(cast(int, details["progress"])),
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
    clear_cad_geometry_for_upload(db, upload)
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


@router.post("/{upload_id}/pointcloud-mesh", response_model=UploadAssetRead)
def create_pointcloud_mesh(upload_id: int, db: Session = Depends(get_db)) -> UploadAsset:
    settings = get_settings()
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.source_type != "pointcloud":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload is not a pointcloud")

    file_path = upload_file_path(upload, Path(settings.upload_dir))
    if file_path.suffix.lower() != ".las":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mesh generation currently supports LAS files")

    upload.status = "converting"
    db.commit()
    set_pointcloud_mesh_progress(upload_id, 1, "preparing")
    try:
        preview, _, _ = las_preview_bytes(file_path, 2_000_000)
        mesh_path = file_path.with_suffix(f"{file_path.suffix}.mesh.glb")
        result = build_surface_glb(
            preview,
            mesh_path,
            progress_callback=lambda percent, stage: set_pointcloud_mesh_progress(upload_id, percent, stage),
        )
        base_message = (upload.message or "").split(" | Mesh ready", 1)[0]
        upload.message = f"{base_message} | Mesh ready ({result['triangle_count']} triangles)"
        upload.status = "ready"
        db.commit()
        db.refresh(upload)
        set_pointcloud_mesh_progress(upload_id, 100, "completed", active=False)
        return upload
    except Exception as exc:
        upload.status = "failed"
        db.commit()
        set_pointcloud_mesh_progress(upload_id, 100, "failed", active=False)
        logger.exception("PointCloud mesh generation failed for upload %s", upload_id)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Mesh generation failed: {exc}") from exc


@router.get("/{upload_id}/pointcloud-mesh-progress")
def get_pointcloud_mesh_progress(upload_id: int, db: Session = Depends(get_db)) -> dict[str, int | str | bool]:
    if db.get(UploadAsset, upload_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    with pointcloud_mesh_progress_lock:
        return pointcloud_mesh_progress.get(upload_id, {
            "upload_id": upload_id,
            "percent": 0,
            "stage": "idle",
            "active": False,
        }).copy()


@router.get("/{upload_id}/pointcloud-mesh")
def get_pointcloud_mesh(upload_id: int, db: Session = Depends(get_db)) -> FileResponse:
    settings = get_settings()
    upload = db.get(UploadAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    file_path = upload_file_path(upload, Path(settings.upload_dir))
    mesh_path = file_path.with_suffix(f"{file_path.suffix}.mesh.glb")
    if not mesh_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PointCloud mesh is not ready")
    return FileResponse(
        mesh_path,
        media_type="model/gltf-binary",
        filename=f"{file_path.stem}-mesh.glb",
        headers={"Cache-Control": "no-cache"},
    )
