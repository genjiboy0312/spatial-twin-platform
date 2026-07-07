from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building, Floor
from app.schemas import BuildingCreate, BuildingRead, FloorCreate, FloorRead

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
