from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, Floor, UploadAsset
from app.schemas import UploadAssetCreate, UploadAssetRead
from app.settings import get_settings

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


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

    upload = UploadAsset(**payload.model_dump(), status="uploaded", message="Metadata-only prototype upload")
    db.add(upload)
    try:
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

    if building_id is not None and db.get(Building, building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "unknown").suffix if file.filename else ""
    unique_name = f"{uuid4().hex}{ext}"
    file_path = upload_dir / unique_name

    content = await file.read()
    file_path.write_bytes(content)

    upload = UploadAsset(
        filename=file.filename or unique_name,
        source_type=source_type,
        building_id=building_id,
        floor_id=floor_id,
        status="uploaded",
        message=f"Stored at {file_path.name}",
    )
    db.add(upload)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload reference") from exc
    db.refresh(upload)
    return upload
