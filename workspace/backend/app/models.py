from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Building(Base):
    __tablename__ = "buildings"
    __table_args__ = (UniqueConstraint("name", "address", name="uq_building_name_address"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    total_floors: Mapped[int] = mapped_column(Integer, default=1)
    origin_longitude: Mapped[float | None]
    origin_latitude: Mapped[float | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    floors: Mapped[list["Floor"]] = relationship(back_populates="building", cascade="all, delete-orphan")
    map_settings: Mapped["BuildingMapSettings | None"] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
    )
    spatial_settings: Mapped["BuildingSpatialSettings | None"] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
    )
    project_assets: Mapped[list["ProjectAsset"]] = relationship(back_populates="building", cascade="all, delete-orphan")
    object_placements: Mapped[list["ObjectPlacement"]] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
    )
    project_snapshot: Mapped["ProjectSnapshot | None"] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
    )
    alignment_audit_logs: Mapped[list["AlignmentAuditLog"]] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
    )


class Floor(Base):
    __tablename__ = "floors"
    __table_args__ = (UniqueConstraint("building_id", "floor_number", name="uq_floor_building_number"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)
    floor_name: Mapped[str | None] = mapped_column(String(50))
    height_meters: Mapped[float] = mapped_column(default=3.0)
    input_type: Mapped[str | None] = mapped_column(String(20))

    building: Mapped[Building] = relationship(back_populates="floors")
    spatial_settings: Mapped["FloorSpatialSettings | None"] = relationship(
        back_populates="floor",
        cascade="all, delete-orphan",
    )
    project_assets: Mapped[list["ProjectAsset"]] = relationship(back_populates="floor")
    object_placements: Mapped[list["ObjectPlacement"]] = relationship(back_populates="floor")


class BuildingMapSettings(Base):
    __tablename__ = "building_map_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), unique=True, index=True)
    origin_latitude: Mapped[float] = mapped_column(default=37.5665)
    origin_longitude: Mapped[float] = mapped_column(default=126.9784)
    osm_zoom: Mapped[int] = mapped_column(Integer, default=16)
    osm_scale: Mapped[float] = mapped_column(default=2.0)
    osm_opacity: Mapped[float] = mapped_column(default=0.72)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    building: Mapped[Building] = relationship(back_populates="map_settings")


class BuildingSpatialSettings(Base):
    __tablename__ = "building_spatial_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), unique=True, index=True)
    apply_to_building: Mapped[bool] = mapped_column(default=True)
    alignment_local_points: Mapped[str | None] = mapped_column(Text)
    alignment_gps_points: Mapped[str | None] = mapped_column(Text)
    glb_transform: Mapped[str | None] = mapped_column(Text)
    render_model_format: Mapped[str | None] = mapped_column(String(20))
    alignment_transform_matrix: Mapped[str | None] = mapped_column(Text)
    alignment_rmse: Mapped[float | None]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    building: Mapped[Building] = relationship(back_populates="spatial_settings")


class AlignmentAuditLog(Base):
    __tablename__ = "alignment_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    point_count: Mapped[int] = mapped_column(Integer, default=0)
    rmse: Mapped[float | None]
    accuracy_json: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    building: Mapped[Building] = relationship(back_populates="alignment_audit_logs")


class FloorSpatialSettings(Base):
    __tablename__ = "floor_spatial_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="CASCADE"), unique=True, index=True)
    alignment_local_points: Mapped[str | None] = mapped_column(Text)
    alignment_gps_points: Mapped[str | None] = mapped_column(Text)
    glb_transform: Mapped[str | None] = mapped_column(Text)
    render_model_format: Mapped[str | None] = mapped_column(String(20))
    alignment_transform_matrix: Mapped[str | None] = mapped_column(Text)
    alignment_rmse: Mapped[float | None]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    floor: Mapped[Floor] = relationship(back_populates="spatial_settings")


class UploadAsset(Base):
    __tablename__ = "upload_assets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int | None] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    floor_id: Mapped[int | None] = mapped_column(ForeignKey("floors.id", ondelete="SET NULL"), index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def file_url(self) -> str | None:
        if not self.message:
            return None
        marker = " from " if " from " in self.message else " at "
        if marker not in self.message:
            return None
        stored_name = self.message.split(marker, 1)[1].split(" ", 1)[0].strip()
        if not stored_name:
            return None
        return f"/api/uploads/{self.id}/file"

    @property
    def pointcloud_preview_url(self) -> str | None:
        if self.source_type != "pointcloud" or self.file_url is None:
            return None
        return f"/api/uploads/{self.id}/pointcloud-preview"


class ProjectAsset(Base):
    __tablename__ = "project_assets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    floor_id: Mapped[int | None] = mapped_column(ForeignKey("floors.id", ondelete="SET NULL"), index=True)
    upload_asset_id: Mapped[int | None] = mapped_column(ForeignKey("upload_assets.id", ondelete="SET NULL"), index=True)
    asset_type: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="registered")
    file_uri: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    building: Mapped[Building] = relationship(back_populates="project_assets")
    floor: Mapped[Floor | None] = relationship(back_populates="project_assets")


class ObjectPlacement(Base):
    __tablename__ = "object_placements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    floor_id: Mapped[int | None] = mapped_column(ForeignKey("floors.id", ondelete="SET NULL"), index=True)
    source_asset_id: Mapped[int | None] = mapped_column(ForeignKey("project_assets.id", ondelete="SET NULL"), index=True)
    object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position_x: Mapped[float] = mapped_column(default=0.0)
    position_y: Mapped[float] = mapped_column(default=0.0)
    position_z: Mapped[float] = mapped_column(default=0.0)
    rotation_x: Mapped[float] = mapped_column(default=0.0)
    rotation_y: Mapped[float] = mapped_column(default=0.0)
    rotation_z: Mapped[float] = mapped_column(default=0.0)
    scale_x: Mapped[float] = mapped_column(default=1.0)
    scale_y: Mapped[float] = mapped_column(default=1.0)
    scale_z: Mapped[float] = mapped_column(default=1.0)
    status: Mapped[str] = mapped_column(String(30), default="active")
    metadata_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    building: Mapped[Building] = relationship(back_populates="object_placements")
    floor: Mapped[Floor | None] = relationship(back_populates="object_placements")


class ProjectSnapshot(Base):
    __tablename__ = "project_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), unique=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    state_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    building: Mapped[Building] = relationship(back_populates="project_snapshot")


class WorkflowProgress(Base):
    __tablename__ = "workflow_progress"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), unique=True, index=True)
    current_step: Mapped[str] = mapped_column(String(50), default="projects")
    completed_steps: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Wall(Base):
    __tablename__ = "walls"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="CASCADE"), index=True)
    x1: Mapped[float]
    y1: Mapped[float]
    x2: Mapped[float]
    y2: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Door(Base):
    __tablename__ = "doors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="CASCADE"), index=True)
    x: Mapped[float]
    y: Mapped[float]
    width: Mapped[float] = mapped_column(default=0.9)
    rotation_degrees: Mapped[float] = mapped_column(default=0.0)
    door_type: Mapped[str] = mapped_column(String(50), default="swing")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Window(Base):
    __tablename__ = "windows"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="CASCADE"), index=True)
    x: Mapped[float]
    y: Mapped[float]
    width: Mapped[float] = mapped_column(default=1.2)
    rotation_degrees: Mapped[float] = mapped_column(default=0.0)
    window_type: Mapped[str] = mapped_column(String(50), default="fixed")
    sill_height_meters: Mapped[float] = mapped_column(default=0.9)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    x: Mapped[float]
    y: Mapped[float]
    w: Mapped[float]
    h: Mapped[float]
    points_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def points(self) -> list[dict[str, float]] | None:
        if not self.points_json:
            return None
        import json

        value = json.loads(self.points_json)
        return value if isinstance(value, list) else None


class SecurityDevice(Base):
    __tablename__ = "security_devices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    device_type: Mapped[str] = mapped_column(String(30))
    pos_x: Mapped[float]
    pos_y: Mapped[float]
    angle: Mapped[float] = mapped_column(default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="active")
    meta: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
