"""add_financial_goals_and_contributions

Revision ID: 8b2c3d4e5f6a
Revises: 7a1b2c3d4e5f
Create Date: 2026-10-29 17:12:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8b2c3d4e5f6a"
down_revision: str | None = "7a1b2c3d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Tabela financial_goals
    op.create_table(
        "financial_goals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("target_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("current_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("deadline_date", sa.Date(), nullable=True),
        sa.Column("account_id", sa.UUID(), nullable=True),
        sa.Column("auto_sync_account", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column(
            "status",
            sa.Enum("IN_PROGRESS", "COMPLETED", "PAUSED", name="goal_status_enum"),
            nullable=False,
            server_default="IN_PROGRESS",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_financial_goals_account_id"), "financial_goals", ["account_id"], unique=False)

    # 2. Tabela goal_contributions
    op.create_table(
        "goal_contributions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("goal_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("contribution_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["financial_goals.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goal_contributions_goal_id"), "goal_contributions", ["goal_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_contributions_goal_id"), table_name="goal_contributions")
    op.drop_table("goal_contributions")
    op.drop_index(op.f("ix_financial_goals_account_id"), table_name="financial_goals")
    op.drop_table("financial_goals")
    sa.Enum("IN_PROGRESS", "COMPLETED", "PAUSED", name="goal_status_enum").drop(op.get_bind(), checkfirst=True)

