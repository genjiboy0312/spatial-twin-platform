from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BuildingBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    total_floors: int = Field(default=1, ge=1, le=300)
    origin_longitude: float | None = Field(default=None, ge=-180, le=180)
    origin_latitude: float | None = Field(default=None, ge=-90, le=90)


class BuildingCreate(BuildingBase):
    pass


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


class UploadAssetCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    source_type: Literal["dxf", "image", "ifc", "glb", "unknown"] = "unknown"
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
