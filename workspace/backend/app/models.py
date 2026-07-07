from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
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


class WorkflowProgress(Base):
    __tablename__ = "workflow_progress"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), unique=True, index=True)
    current_step: Mapped[str] = mapped_column(String(50), default="projects")
    completed_steps: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
