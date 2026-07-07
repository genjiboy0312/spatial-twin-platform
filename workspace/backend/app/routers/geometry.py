from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Floor, Room, Wall
from app.schemas import (
    RoomCreate,
    RoomRead,
    RoomUpdate,
    WallCreate,
    WallRead,
    WallUpdate,
)

router = APIRouter(prefix="/api", tags=["geometry"])


# ── Walls ──


@router.get("/floors/{floor_id}/walls", response_model=list[WallRead])
def list_walls(floor_id: int, db: Session = Depends(get_db)) -> list[Wall]:
    _ensure_floor_exists(db, floor_id)
    return list(
        db.scalars(select(Wall).where(Wall.floor_id == floor_id).order_by(Wall.id))
    )


@router.post("/floors/{floor_id}/walls", response_model=WallRead, status_code=status.HTTP_201_CREATED)
def create_wall(floor_id: int, payload: WallCreate, db: Session = Depends(get_db)) -> Wall:
    _ensure_floor_exists(db, floor_id)
    wall = Wall(floor_id=floor_id, **payload.model_dump())
    db.add(wall)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid wall data") from exc
    db.refresh(wall)
    return wall


@router.put("/walls/{wall_id}", response_model=WallRead)
def update_wall(wall_id: int, payload: WallUpdate, db: Session = Depends(get_db)) -> Wall:
    wall = db.get(Wall, wall_id)
    if wall is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wall not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wall, field, value)
    db.commit()
    db.refresh(wall)
    return wall


@router.delete("/walls/{wall_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wall(wall_id: int, db: Session = Depends(get_db)) -> None:
    wall = db.get(Wall, wall_id)
    if wall is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wall not found")
    db.delete(wall)
    db.commit()


# ── Rooms ──


@router.get("/floors/{floor_id}/rooms", response_model=list[RoomRead])
def list_rooms(floor_id: int, db: Session = Depends(get_db)) -> list[Room]:
    _ensure_floor_exists(db, floor_id)
    return list(
        db.scalars(select(Room).where(Room.floor_id == floor_id).order_by(Room.id))
    )


@router.post("/floors/{floor_id}/rooms", response_model=RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(floor_id: int, payload: RoomCreate, db: Session = Depends(get_db)) -> Room:
    _ensure_floor_exists(db, floor_id)
    room = Room(floor_id=floor_id, **payload.model_dump())
    db.add(room)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid room data") from exc
    db.refresh(room)
    return room


@router.put("/rooms/{room_id}", response_model=RoomRead)
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: Session = Depends(get_db)) -> None:
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    db.delete(room)
    db.commit()


# ── Helpers ──


def _ensure_floor_exists(db: Session, floor_id: int) -> None:
    if db.get(Floor, floor_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor not found")
