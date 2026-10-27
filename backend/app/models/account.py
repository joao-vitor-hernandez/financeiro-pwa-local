from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
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


class AccountType(str, enum.Enum):
    CHECKING = "CHECKING"  # Conta Corrente
    CREDIT_CARD = "CREDIT_CARD"  # Cartão de Crédito
    INVESTMENT = "INVESTMENT"  # Conta de Investimentos / Reserva
    CASH = "CASH"  # Dinheiro em espécie / Carteira
    SAVINGS = "SAVINGS"  # Poupança / Caixinhas


class Account(Base):
    """
    Modelo de Contas e Cartões Financeiros.
    """

    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[AccountType] = mapped_column(
        SQLEnum(AccountType, name="account_type_enum"), nullable=False
    )
    # Precisão arbitrária: NUMERIC(15, 2)
    balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="BRL", nullable=False)

    # Específico para Cartão de Crédito
    closing_day: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # Dia de corte/fechamento
    due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Dia de vencimento
    credit_limit: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=15, scale=2), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pluggy_account_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relacionamentos
    transactions: Mapped[list[Transaction]] = relationship(
        "Transaction", back_populates="account", foreign_keys="Transaction.account_id"
    )
    credit_card_bills: Mapped[list[CreditCardBill]] = relationship(
        "CreditCardBill", back_populates="account", cascade="all, delete-orphan"
    )
