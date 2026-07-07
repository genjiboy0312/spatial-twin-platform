from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Floor, SecurityDevice
from app.schemas import SecurityDeviceCreate, SecurityDeviceRead, SecurityDeviceUpdate

router = APIRouter(prefix="/api", tags=["security-devices"])


@router.get("/floors/{floor_id}/devices", response_model=list[SecurityDeviceRead])
def list_devices(floor_id: int, db: Session = Depends(get_db)) -> list[SecurityDevice]:
    _ensure_floor_exists(db, floor_id)
    return list(
        db.scalars(
            select(SecurityDevice)
            .where(SecurityDevice.floor_id == floor_id)
            .order_by(SecurityDevice.id)
        )
    )


@router.post(
    "/floors/{floor_id}/devices",
    response_model=SecurityDeviceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_device(
    floor_id: int,
    payload: SecurityDeviceCreate,
    db: Session = Depends(get_db),
) -> SecurityDevice:
    _ensure_floor_exists(db, floor_id)
    device = SecurityDevice(floor_id=floor_id, **payload.model_dump())
    db.add(device)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid device data"
        ) from exc
    db.refresh(device)
    return device


@router.get("/devices/{device_id}", response_model=SecurityDeviceRead)
def get_device(device_id: int, db: Session = Depends(get_db)) -> SecurityDevice:
    device = db.get(SecurityDevice, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.put("/devices/{device_id}", response_model=SecurityDeviceRead)
def update_device(
    device_id: int,
    payload: SecurityDeviceUpdate,
    db: Session = Depends(get_db),
) -> SecurityDevice:
    device = db.get(SecurityDevice, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, field, value)
    db.commit()
    db.refresh(device)
    return device


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: int, db: Session = Depends(get_db)) -> None:
    device = db.get(SecurityDevice, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    db.delete(device)
    db.commit()


def _ensure_floor_exists(db: Session, floor_id: int) -> None:
    if db.get(Floor, floor_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")
