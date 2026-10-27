import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, condecimal

from app.models.account import AccountType

MoneyDecimal = condecimal(max_digits=15, decimal_places=2)


class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: AccountType
    currency: str = Field(default="BRL", max_length=3)
    closing_day: int | None = Field(default=None, ge=1, le=31)
    due_day: int | None = Field(default=None, ge=1, le=31)
    credit_limit: MoneyDecimal | None = None


class AccountCreate(AccountBase):
    initial_balance: MoneyDecimal = Field(default=Decimal("0.00"))


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    closing_day: int | None = Field(default=None, ge=1, le=31)
    due_day: int | None = Field(default=None, ge=1, le=31)
    credit_limit: MoneyDecimal | None = None
    is_active: bool | None = None


class AccountResponse(AccountBase):
    id: uuid.UUID
    balance: Decimal
    is_active: bool
    pluggy_account_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
