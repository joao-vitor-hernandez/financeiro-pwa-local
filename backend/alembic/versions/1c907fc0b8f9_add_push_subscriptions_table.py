"""add_push_subscriptions_table

Revision ID: 1c907fc0b8f9
Revises: 8b2c3d4e5f6a
Create Date: 2026-10-29 19:18:22.897509

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '1c907fc0b8f9'
down_revision: str | None = '8b2c3d4e5f6a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'push_subscriptions' not in tables:
        op.create_table(
            'push_subscriptions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
            sa.Column('endpoint', sa.Text(), nullable=False),
            sa.Column('p256dh', sa.String(length=255), nullable=False),
            sa.Column('auth', sa.String(length=255), nullable=False),
            sa.Column('user_agent', sa.String(length=500), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index(op.f('ix_push_subscriptions_endpoint'), 'push_subscriptions', ['endpoint'], unique=True)
        op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'push_subscriptions' in tables:
        op.drop_index(op.f('ix_push_subscriptions_user_id'), table_name='push_subscriptions')
        op.drop_index(op.f('ix_push_subscriptions_endpoint'), table_name='push_subscriptions')
        op.drop_table('push_subscriptions')
