from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CategorizationRule(Base):
    """
    Regras determinísticas de categorização e sanitização de lançamentos.
    Aplica expressões regulares (Regex) sobre a descrição da transação.
    """

    __tablename__ = "categorization_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Padrão Regex (ex: r"(?i)uber|99app" ou r"PAG\*([a-zA-Z0-9]+)")
    pattern: Mapped[str] = mapped_column(String(255), nullable=False)

    # Nome limpo sugerido para substituir o texto poluído do extrato (opcional)
    clean_description: Mapped[str | None] = mapped_column(String(100), nullable=True)

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )

    # Prioridade de execução (menor número = maior prioridade)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relacionamento com a Categoria alvo
    category: Mapped[Category] = relationship("Category", lazy="selectin")
