from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BillStatus(str, enum.Enum):
    OPEN = "OPEN"  # Fatura aberta (recebendo novos lançamentos)
    CLOSED = "CLOSED"  # Fatura fechada (aguardando pagamento)
    PAID = "PAID"  # Fatura liquidada / paga


class CreditCardBill(Base):
    """
    Faturas de Cartão de Crédito.
    Representa o ciclo de faturamento mensal associado a um cartão.
    """

    __tablename__ = "credit_card_bills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Mês e ano de referência da fatura (mês do vencimento)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    closing_date: Mapped[date] = mapped_column(Date, nullable=False)  # Data de corte/fechamento
    due_date: Mapped[date] = mapped_column(Date, nullable=False)  # Data de vencimento

    status: Mapped[BillStatus] = mapped_column(
        SQLEnum(BillStatus, name="bill_status_enum"),
        default=BillStatus.OPEN,
        nullable=False,
    )

    # Valor total consolidado da fatura com precisão Decimal
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2), default=Decimal("0.00"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relacionamentos
    account: Mapped[Account] = relationship("Account", back_populates="credit_card_bills")
    transactions: Mapped[list[Transaction]] = relationship("Transaction", back_populates="bill")

    # Restrição única: Um cartão não pode ter duas faturas para o mesmo mês/ano
    __table_args__ = (
        UniqueConstraint("account_id", "month", "year", name="uq_card_bill_month_year"),
    )
