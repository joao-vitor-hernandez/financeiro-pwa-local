import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetAllocationTarget(Base):
    """
    Metas de Alocação Patrimonial e Benchmark CDI (Fase 8.4 - Inspirado no Ghostfolio).
    Armazena os percentuais ideais de alocação entre Dinheiro em Conta, Cofrinhos/Reserva e Investimentos,
    além da taxa anual do CDI para benchmark de rentabilidade.
    """

    __tablename__ = "asset_allocation_targets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checking_target_pct: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2), default=Decimal("20.00"), nullable=False
    )
    savings_target_pct: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2), default=Decimal("40.00"), nullable=False
    )
    investment_target_pct: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2), default=Decimal("40.00"), nullable=False
    )
    cdi_annual_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2), default=Decimal("11.25"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
