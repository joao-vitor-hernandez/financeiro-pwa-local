from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import enum
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.account import Account


class GoalStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"  # Em andamento
    COMPLETED = "COMPLETED"  # Concluída / Atingida
    PAUSED = "PAUSED"  # Pausada temporariamente


class FinancialGoal(Base):
    """
    Central de Metas Financeiras & Objetivos (Fase 7.2).
    Permite rastrear objetivos específicos (Reserva de Emergência, Viagem, etc.),
    com cálculo de progresso percentual, ritmo mensal necessário e vínculo com contas SAVINGS.
    """

    __tablename__ = "financial_goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Valores monetários em NUMERIC(15, 2)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(precision=15, scale=2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2), default=Decimal("0.00"), nullable=False
    )

    deadline_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Vínculo opcional com contas SAVINGS (cofrinhos, caixinhas, reserva)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    auto_sync_account: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    icon: Mapped[str | None] = mapped_column(String(50), default="target", nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), default="#21D0B2", nullable=True)

    status: Mapped[GoalStatus] = mapped_column(
        SQLEnum(GoalStatus, name="goal_status_enum"), default=GoalStatus.IN_PROGRESS, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relacionamentos
    account: Mapped[Account | None] = relationship("Account", lazy="joined")
    contributions: Mapped[list[GoalContribution]] = relationship(
        "GoalContribution",
        back_populates="goal",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="desc(GoalContribution.contribution_date)",
    )


class GoalContribution(Base):
    """
    Histórico de Aportes ou Resgates vinculados a uma Meta Financeira.
    """

    __tablename__ = "goal_contributions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("financial_goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=15, scale=2), nullable=False)
    contribution_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    goal: Mapped[FinancialGoal] = relationship("FinancialGoal", back_populates="contributions")

