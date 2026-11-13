"""add_asset_allocation_targets_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-13 17:15:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "asset_allocation_targets" not in tables:
        op.create_table(
            "asset_allocation_targets",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "checking_target_pct",
                sa.Numeric(precision=5, scale=2),
                nullable=False,
                server_default="20.00",
            ),
            sa.Column(
                "savings_target_pct",
                sa.Numeric(precision=5, scale=2),
                nullable=False,
                server_default="40.00",
            ),
            sa.Column(
                "investment_target_pct",
                sa.Numeric(precision=5, scale=2),
                nullable=False,
                server_default="40.00",
            ),
            sa.Column(
                "cdi_annual_rate",
                sa.Numeric(precision=5, scale=2),
                nullable=False,
                server_default="11.25",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "asset_allocation_targets" in tables:
        op.drop_table("asset_allocation_targets")
