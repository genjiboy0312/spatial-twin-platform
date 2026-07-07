from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, Floor, UploadAsset
from app.schemas import UploadAssetCreate, UploadAssetRead

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.get("", response_model=list[UploadAssetRead])
def list_uploads(db: Session = Depends(get_db)) -> list[UploadAsset]:
    return list(db.scalars(select(UploadAsset).order_by(UploadAsset.id.desc())))


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
