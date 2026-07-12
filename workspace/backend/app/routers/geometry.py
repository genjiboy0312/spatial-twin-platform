from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Door, Floor, Room, Wall, Window
from app.schemas import (
    DoorCreate,
    DoorRead,
    DoorUpdate,
    FloorGeometrySyncPayload,
    FloorGeometrySyncRead,
    RoomCreate,
    RoomRead,
    RoomUpdate,
    WallCreate,
    WallRead,
    WallUpdate,
    WindowCreate,
    WindowRead,
    WindowUpdate,
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


# Doors


@router.get("/floors/{floor_id}/doors", response_model=list[DoorRead])
def list_doors(floor_id: int, db: Session = Depends(get_db)) -> list[Door]:
    _ensure_floor_exists(db, floor_id)
    return list(db.scalars(select(Door).where(Door.floor_id == floor_id).order_by(Door.id)))


@router.post("/floors/{floor_id}/doors", response_model=DoorRead, status_code=status.HTTP_201_CREATED)
def create_door(floor_id: int, payload: DoorCreate, db: Session = Depends(get_db)) -> Door:
    _ensure_floor_exists(db, floor_id)
    door = Door(floor_id=floor_id, **payload.model_dump())
    db.add(door)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid door data") from exc
    db.refresh(door)
    return door


@router.put("/doors/{door_id}", response_model=DoorRead)
def update_door(door_id: int, payload: DoorUpdate, db: Session = Depends(get_db)) -> Door:
    door = db.get(Door, door_id)
    if door is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Door not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(door, field, value)
    db.commit()
    db.refresh(door)
    return door


@router.delete("/doors/{door_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_door(door_id: int, db: Session = Depends(get_db)) -> None:
    door = db.get(Door, door_id)
    if door is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Door not found")
    db.delete(door)
    db.commit()


# Windows


@router.get("/floors/{floor_id}/windows", response_model=list[WindowRead])
def list_windows(floor_id: int, db: Session = Depends(get_db)) -> list[Window]:
    _ensure_floor_exists(db, floor_id)
    return list(db.scalars(select(Window).where(Window.floor_id == floor_id).order_by(Window.id)))


@router.post("/floors/{floor_id}/windows", response_model=WindowRead, status_code=status.HTTP_201_CREATED)
def create_window(floor_id: int, payload: WindowCreate, db: Session = Depends(get_db)) -> Window:
    _ensure_floor_exists(db, floor_id)
    window = Window(floor_id=floor_id, **payload.model_dump())
    db.add(window)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid window data") from exc
    db.refresh(window)
    return window


@router.put("/windows/{window_id}", response_model=WindowRead)
def update_window(window_id: int, payload: WindowUpdate, db: Session = Depends(get_db)) -> Window:
    window = db.get(Window, window_id)
    if window is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Window not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(window, field, value)
    db.commit()
    db.refresh(window)
    return window


@router.delete("/windows/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_window(window_id: int, db: Session = Depends(get_db)) -> None:
    window = db.get(Window, window_id)
    if window is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Window not found")
    db.delete(window)
    db.commit()


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


@router.get("/floors/{floor_id}/geometry", response_model=FloorGeometrySyncRead)
def get_floor_geometry(floor_id: int, db: Session = Depends(get_db)) -> FloorGeometrySyncRead:
    _ensure_floor_exists(db, floor_id)
    walls = list(db.scalars(select(Wall).where(Wall.floor_id == floor_id).order_by(Wall.id)))
    rooms = list(db.scalars(select(Room).where(Room.floor_id == floor_id).order_by(Room.id)))
    return FloorGeometrySyncRead(floor_id=floor_id, walls=walls, rooms=rooms)


@router.put("/floors/{floor_id}/geometry", response_model=FloorGeometrySyncRead)
def sync_floor_geometry(
    floor_id: int,
    payload: FloorGeometrySyncPayload,
    db: Session = Depends(get_db),
) -> FloorGeometrySyncRead:
    _ensure_floor_exists(db, floor_id)
    for wall in db.scalars(select(Wall).where(Wall.floor_id == floor_id)):
        db.delete(wall)
    for room in db.scalars(select(Room).where(Room.floor_id == floor_id)):
        db.delete(room)

    walls = [Wall(floor_id=floor_id, **wall.model_dump()) for wall in payload.walls]
    rooms = [Room(floor_id=floor_id, **room.model_dump()) for room in payload.rooms]
    db.add_all([*walls, *rooms])
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid floor geometry") from exc
    for item in [*walls, *rooms]:
        db.refresh(item)
    return FloorGeometrySyncRead(floor_id=floor_id, walls=walls, rooms=rooms)


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
