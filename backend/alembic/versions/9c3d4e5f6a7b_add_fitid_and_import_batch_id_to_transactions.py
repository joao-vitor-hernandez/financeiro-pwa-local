"""add_fitid_and_import_batch_id_to_transactions

Revision ID: 9c3d4e5f6a7b
Revises: 1c907fc0b8f9
Create Date: 2026-11-06 18:15:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c3d4e5f6a7b"
down_revision: str | None = "1c907fc0b8f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("transactions")]

    if "fitid" not in columns:
        op.add_column("transactions", sa.Column("fitid", sa.String(length=120), nullable=True))
        op.create_index(op.f("ix_transactions_fitid"), "transactions", ["fitid"], unique=True)

    if "import_batch_id" not in columns:
        op.add_column(
            "transactions",
            sa.Column("import_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index(
            op.f("ix_transactions_import_batch_id"), "transactions", ["import_batch_id"], unique=False
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("transactions")]

    if "import_batch_id" in columns:
        op.drop_index(op.f("ix_transactions_import_batch_id"), table_name="transactions")
        op.drop_column("transactions", "import_batch_id")

    if "fitid" in columns:
        op.drop_index(op.f("ix_transactions_fitid"), table_name="transactions")
        op.drop_column("transactions", "fitid")
