"""add_transaction_attachments_table

Revision ID: a1b2c3d4e5f6
Revises: 9c3d4e5f6a7b
Create Date: 2026-11-12 21:40:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "9c3d4e5f6a7b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "transaction_attachments" not in tables:
        op.create_table(
            "transaction_attachments",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "transaction_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("transactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("file_size_bytes", sa.Integer(), nullable=False),
            sa.Column("mime_type", sa.String(length=100), nullable=False),
            sa.Column("storage_key", sa.String(length=512), nullable=False),
            sa.Column("storage_provider", sa.String(length=30), nullable=False, server_default="LOCAL"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index(
            op.f("ix_transaction_attachments_transaction_id"),
            "transaction_attachments",
            ["transaction_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_transaction_attachments_storage_key"),
            "transaction_attachments",
            ["storage_key"],
            unique=True,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "transaction_attachments" in tables:
        op.drop_index(
            op.f("ix_transaction_attachments_storage_key"),
            table_name="transaction_attachments",
        )
        op.drop_index(
            op.f("ix_transaction_attachments_transaction_id"),
            table_name="transaction_attachments",
        )
        op.drop_table("transaction_attachments")
