from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class BuildingBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    total_floors: int = Field(default=1, ge=1, le=300)
    origin_longitude: float | None = Field(default=None, ge=-180, le=180)
    origin_latitude: float | None = Field(default=None, ge=-90, le=90)


class BuildingCreate(BuildingBase):
    pass


class BuildingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    total_floors: int | None = Field(default=None, ge=1, le=300)
    origin_longitude: float | None = Field(default=None, ge=-180, le=180)
    origin_latitude: float | None = Field(default=None, ge=-90, le=90)


class BuildingRead(BuildingBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class FloorCreate(BaseModel):
    floor_number: int
    floor_name: str | None = None
    height_meters: float = Field(default=3.0, gt=0, le=20)
    input_type: str | None = None


class FloorRead(FloorCreate):
    id: int
    building_id: int

    model_config = ConfigDict(from_attributes=True)


class BuildingMapSettingsPayload(BaseModel):
    origin_latitude: float = Field(ge=-90, le=90)
    origin_longitude: float = Field(ge=-180, le=180)
    osm_zoom: int = Field(default=16, ge=1, le=22)
    osm_scale: float = Field(default=2.0, gt=0, le=100)
    osm_opacity: float = Field(default=0.72, ge=0, le=1)


class BuildingMapSettingsRead(BuildingMapSettingsPayload):
    building_id: int
    saved: bool = False
    updated_at: datetime | None = None


class SpatialSettingsPayload(BaseModel):
    apply_to_building: bool | None = None
    alignment_local_points: Any | None = None
    alignment_gps_points: Any | None = None
    glb_transform: Any | None = None
    render_model_format: Literal["glb", "dxf"] | None = None
    alignment_transform_matrix: Any | None = None
    alignment_rmse: float | None = None


class SpatialSettingsRead(SpatialSettingsPayload):
    building_id: int | None = None
    floor_id: int | None = None
    saved: bool = False
    updated_at: datetime | None = None


class GpsControlPoint(BaseModel):
    local: tuple[float, float]
    gps: tuple[float, float]


class GpsThreePointRequest(BaseModel):
    building_id: int
    points: list[GpsControlPoint] = Field(min_length=3)


class GpsThreePointResponse(BaseModel):
    building_id: int
    transform_matrix: list[list[float]]
    rmse: float


class GpsTransformPointRequest(BaseModel):
    building_id: int
    local_point: tuple[float, float]
    transform_matrix: list[list[float]]


class GpsTransformPointResponse(BaseModel):
    gps_point: tuple[float, float]


class GpsBatchTransformPointRequest(BaseModel):
    building_id: int
    local_points: list[tuple[float, float]] = Field(min_length=1)
    transform_matrix: list[list[float]]


class GpsBatchTransformPointResponse(BaseModel):
    gps_points: list[tuple[float, float]]


class UploadAssetCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    source_type: Literal["dxf", "image", "ifc", "glb", "pointcloud", "unknown"] = "unknown"
    building_id: int | None = None
    floor_id: int | None = None


class UploadAssetRead(UploadAssetCreate):
    id: int
    status: str
    message: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowRead(BaseModel):
    building_id: int
    current_step: str
    completed_steps: list[str]


class WorkflowUpdate(BaseModel):
    current_step: str | None = None
    completed_steps: list[str] | None = None


# ── Geometry ──


class WallCreate(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class WallUpdate(BaseModel):
    x1: float | None = None
    y1: float | None = None
    x2: float | None = None
    y2: float | None = None


class WallRead(WallCreate):
    id: int
    floor_id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DoorCreate(BaseModel):
    x: float
    y: float
    width: float = Field(default=0.9, gt=0, le=10)
    rotation_degrees: float = 0.0
    door_type: str = Field(default="swing", min_length=1, max_length=50)


class DoorUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    width: float | None = Field(default=None, gt=0, le=10)
    rotation_degrees: float | None = None
    door_type: str | None = Field(default=None, min_length=1, max_length=50)


class DoorRead(DoorCreate):
    id: int
    floor_id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class WindowCreate(BaseModel):
    x: float
    y: float
    width: float = Field(default=1.2, gt=0, le=20)
    rotation_degrees: float = 0.0
    window_type: str = Field(default="fixed", min_length=1, max_length=50)
    sill_height_meters: float = Field(default=0.9, ge=0, le=5)


class WindowUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    width: float | None = Field(default=None, gt=0, le=20)
    rotation_degrees: float | None = None
    window_type: str | None = Field(default=None, min_length=1, max_length=50)
    sill_height_meters: float | None = Field(default=None, ge=0, le=5)


class WindowRead(WindowCreate):
    id: int
    floor_id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class RoomUpdate(BaseModel):
    name: str | None = None
    x: float | None = None
    y: float | None = None
    w: float | None = None
    h: float | None = None


class RoomRead(RoomCreate):
    id: int
    floor_id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ── Security Device ──


class SecurityDeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    device_type: str = Field(min_length=1, max_length=30)
    pos_x: float
    pos_y: float
    angle: float = 0.0
    status: str = "active"
    meta: str | None = None


class SecurityDeviceUpdate(BaseModel):
    name: str | None = None
    device_type: str | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    angle: float | None = None
    status: str | None = None
    meta: str | None = None


class SecurityDeviceRead(SecurityDeviceCreate):
    id: int
    floor_id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
