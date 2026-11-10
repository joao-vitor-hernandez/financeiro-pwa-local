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

    model_config = ConfigDict(extra="forbid")


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

    # Conectores Bancários / OFX
    fitid: str | None = None
    import_batch_id: uuid.UUID | None = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OFXTransactionPreview(BaseModel):
    fitid: str
    description: str
    amount: Decimal
    transaction_date: datetime
    type: TransactionType
    is_duplicate: bool

    model_config = ConfigDict(extra="forbid")


class OFXPreviewResponse(BaseModel):
    total_found: int
    new_count: int
    duplicated_count: int
    transactions: list[OFXTransactionPreview]

    model_config = ConfigDict(extra="forbid")


class OFXImportResponse(BaseModel):
    import_batch_id: uuid.UUID
    total_found: int
    imported_count: int
    duplicated_count: int
    transactions: list[TransactionResponse]

    model_config = ConfigDict(extra="forbid")
