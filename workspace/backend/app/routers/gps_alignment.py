import json
import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AlignmentAuditLog, Building
from app.schemas import (
    AlignmentAuditLogRead,
    GpsAccuracyMetadata,
    GpsBatchTransformPointRequest,
    GpsBatchTransformPointResponse,
    GpsControlPoint,
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
    accuracy = _compute_accuracy(payload.points, matrix, rmse)
    _record_audit_log(db, payload, matrix, accuracy)
    return GpsThreePointResponse(
        building_id=payload.building_id,
        transform_matrix=matrix,
        rmse=rmse,
        accuracy=accuracy,
    )


@router.get("/buildings/{building_id}/audit-logs", response_model=list[AlignmentAuditLogRead])
def list_alignment_audit_logs(building_id: int, db: Session = Depends(get_db)) -> list[AlignmentAuditLogRead]:
    _ensure_building_exists(db, building_id)
    logs = (
        db.query(AlignmentAuditLog)
        .filter(AlignmentAuditLog.building_id == building_id)
        .order_by(AlignmentAuditLog.created_at.desc(), AlignmentAuditLog.id.desc())
        .limit(20)
        .all()
    )
    return [_to_audit_read(log) for log in logs]


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


def _compute_accuracy(
    points: list[GpsControlPoint],
    matrix: list[list[float]],
    rmse: float,
) -> GpsAccuracyMetadata:
    errors = []
    for point in points:
        expected_lat, expected_lng = point.gps
        actual_lat, actual_lng = transform_point(point.local, matrix)
        errors.append(_gps_distance_meters(expected_lat, expected_lng, actual_lat, actual_lng))

    mean_error = sum(errors) / len(errors)
    max_error = max(errors)
    rmse_meters = math.sqrt(sum(error * error for error in errors) / len(errors))
    quality = _quality_from_rmse(rmse_meters)
    return GpsAccuracyMetadata(
        quality=quality,
        point_count=len(points),
        rmse=rmse,
        rmse_meters=rmse_meters,
        mean_error_meters=mean_error,
        max_error_meters=max_error,
    )


def _gps_distance_meters(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    lat_meters = (lat_b - lat_a) * 111_320
    lng_meters = (lng_b - lng_a) * 111_320 * math.cos(math.radians((lat_a + lat_b) / 2))
    return math.hypot(lat_meters, lng_meters)


def _quality_from_rmse(rmse_meters: float) -> str:
    if rmse_meters <= 0.2:
        return "excellent"
    if rmse_meters <= 0.75:
        return "good"
    if rmse_meters <= 2.0:
        return "review"
    return "poor"


def _record_audit_log(
    db: Session,
    payload: GpsThreePointRequest,
    matrix: list[list[float]],
    accuracy: GpsAccuracyMetadata,
) -> None:
    log = AlignmentAuditLog(
        building_id=payload.building_id,
        action="three-point-align",
        point_count=len(payload.points),
        rmse=accuracy.rmse,
        accuracy_json=accuracy.model_dump_json(),
        metadata_json=json.dumps(
            {
                "transform_matrix": matrix,
                "control_points": [
                    {"local": list(point.local), "gps": list(point.gps)}
                    for point in payload.points
                ],
            },
            ensure_ascii=True,
        ),
    )
    db.add(log)
    db.commit()


def _to_audit_read(log: AlignmentAuditLog) -> AlignmentAuditLogRead:
    accuracy = GpsAccuracyMetadata.model_validate_json(log.accuracy_json) if log.accuracy_json else None
    metadata = json.loads(log.metadata_json) if log.metadata_json else None
    return AlignmentAuditLogRead(
        id=log.id,
        building_id=log.building_id,
        action=log.action,
        point_count=log.point_count,
        rmse=log.rmse,
        accuracy=accuracy,
        metadata=metadata,
        created_at=log.created_at,
    )
