"""Add alignment audit logs.

Revision ID: 0002_alignment_audit_logs
Revises: 0001_initial_schema
Create Date: 2026-07-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0002_alignment_audit_logs"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("alignment_audit_logs"):
        return

    op.create_table(
        "alignment_audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("point_count", sa.Integer(), nullable=False),
        sa.Column("rmse", sa.Float(), nullable=True),
        sa.Column("accuracy_json", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alignment_audit_logs_id"), "alignment_audit_logs", ["id"], unique=False)
    op.create_index(op.f("ix_alignment_audit_logs_building_id"), "alignment_audit_logs", ["building_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("alignment_audit_logs"):
        return

    op.drop_index(op.f("ix_alignment_audit_logs_building_id"), table_name="alignment_audit_logs")
    op.drop_index(op.f("ix_alignment_audit_logs_id"), table_name="alignment_audit_logs")
    op.drop_table("alignment_audit_logs")
