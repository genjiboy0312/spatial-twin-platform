"""Add polygon points to rooms.

Revision ID: 0003_room_polygon_points
Revises: 0002_alignment_audit_logs
Create Date: 2026-07-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0003_room_polygon_points"
down_revision: str | None = "0002_alignment_audit_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("rooms"):
        return
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    if "points_json" not in columns:
        op.add_column("rooms", sa.Column("points_json", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("rooms"):
        return
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    if "points_json" in columns:
        op.drop_column("rooms", "points_json")
