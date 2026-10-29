import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, condecimal

from app.models.transaction import TransactionType

PositiveMoneyDecimal = condecimal(gt=Decimal("0.00"), max_digits=15, decimal_places=2)


class TransactionBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: PositiveMoneyDecimal
    transaction_date: datetime
    type: TransactionType
    category_id: uuid.UUID | None = None


class TransactionCreate(TransactionBase):
    account_id: uuid.UUID

    # Compras parceladas (opcional)
    installments: int = Field(default=1, ge=1, le=96)

    # Transferência entre contas próprias (partidas dobradas)
    is_transfer: bool = False
    transfer_target_account_id: uuid.UUID | None = None

    # Chave de idempotência para sincronização offline resiliente (Outbox)
    client_tx_id: str | None = None


class TransactionResponse(TransactionBase):
    id: uuid.UUID
    account_id: uuid.UUID
    bill_id: uuid.UUID | None = None
    original_description: str | None = None

    is_transfer: bool
    transfer_target_account_id: uuid.UUID | None = None
    transfer_pair_id: uuid.UUID | None = None

    installment_number: int | None = None
    total_installments: int | None = None
    installment_identifier: uuid.UUID | None = None

    external_id: str | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
