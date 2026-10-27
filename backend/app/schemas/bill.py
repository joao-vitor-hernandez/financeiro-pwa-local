import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.credit_card_bill import BillStatus


class CreditCardBillResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    month: int
    year: int
    closing_date: date
    due_date: date
    status: BillStatus
    total_amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
