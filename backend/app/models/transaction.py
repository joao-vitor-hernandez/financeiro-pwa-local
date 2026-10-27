from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TransactionType(str, enum.Enum):
    INCOME = "INCOME"  # Entrada / Receita
    EXPENSE = "EXPENSE"  # Saída / Despesa


class Transaction(Base):
    """
    Lançamentos Financeiros (Transações).
    Suporta contas correntes, cartões de crédito, parcelamentos e transferências neutras.
    """

    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("credit_card_bills.id", ondelete="SET NULL"),
        nullable=True,
    )

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    original_description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Valor monetário sempre positivo; o tipo define a operação contábil
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2), nullable=False
    )
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    type: Mapped[TransactionType] = mapped_column(
        SQLEnum(TransactionType, name="transaction_type_enum"), nullable=False
    )

    # Partidas Dobradas: Transferência entre contas próprias
    is_transfer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    transfer_target_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    transfer_pair_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Parcelamentos
    installment_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_installments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    installment_identifier: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Open Finance / Pluggy
    external_id: Mapped[str | None] = mapped_column(String(150), nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

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
    account: Mapped[Account] = relationship(
        "Account", back_populates="transactions", foreign_keys=[account_id]
    )
    category: Mapped[Category | None] = relationship(
        "Category", back_populates="transactions"
    )
    bill: Mapped[CreditCardBill | None] = relationship(
        "CreditCardBill", back_populates="transactions"
    )

    # Restrição única para idempotência com Open Finance
    __table_args__ = (
        UniqueConstraint(
            "account_id",
            "external_id",
            "transaction_date",
            "amount",
            name="uq_account_ext_tx_idempotency",
        ),
    )
