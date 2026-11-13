from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class TransactionAttachment(Base):
    """
    Anexos e Comprovantes de Transações (Fase 8.3 - Inspirado no Firefly III).
    Armazena notas fiscais, fotos de recibos e comprovantes em PDF vinculados a lançamentos contábeis.
    Suporta armazenamento no Cloudflare R2 (S3) com fallback local em disco.
    """

    __tablename__ = "transaction_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(30), nullable=False, default="LOCAL")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relacionamento com a transação pai
    transaction: Mapped[Transaction] = relationship("Transaction", back_populates="attachments")

    @property
    def view_url(self) -> str:
        from app.services.storage_service import storage_service

        return storage_service.get_view_url(self.id, self.storage_key, self.storage_provider)

