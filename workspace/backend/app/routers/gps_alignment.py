from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Building
from app.schemas import (
    GpsBatchTransformPointRequest,
    GpsBatchTransformPointResponse,
    GpsThreePointRequest,
    GpsThreePointResponse,
    GpsTransformPointRequest,
    GpsTransformPointResponse,
)
from app.services.gps_alignment import compute_affine_transform, transform_point

router = APIRouter(prefix="/api/gps-alignment", tags=["gps-alignment"])


@router.post("/three-point", response_model=GpsThreePointResponse)
def compute_three_point_alignment(payload: GpsThreePointRequest, db: Session = Depends(get_db)) -> GpsThreePointResponse:
    _ensure_building_exists(db, payload.building_id)
    try:
        matrix, rmse = compute_affine_transform(
            [point.local for point in payload.points],
            [point.gps for point in payload.points],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GpsThreePointResponse(building_id=payload.building_id, transform_matrix=matrix, rmse=rmse)


@router.post("/transform-point", response_model=GpsTransformPointResponse)
def transform_local_to_gps(payload: GpsTransformPointRequest, db: Session = Depends(get_db)) -> GpsTransformPointResponse:
    _ensure_building_exists(db, payload.building_id)
    try:
        gps_point = transform_point(payload.local_point, payload.transform_matrix)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GpsTransformPointResponse(gps_point=gps_point)


@router.post("/batch-transform-point", response_model=GpsBatchTransformPointResponse)
def batch_transform_local_to_gps(
    payload: GpsBatchTransformPointRequest,
    db: Session = Depends(get_db),
) -> GpsBatchTransformPointResponse:
    _ensure_building_exists(db, payload.building_id)
    try:
        gps_points = [transform_point(point, payload.transform_matrix) for point in payload.local_points]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GpsBatchTransformPointResponse(gps_points=gps_points)


def _ensure_building_exists(db: Session, building_id: int) -> None:
    if db.get(Building, building_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
