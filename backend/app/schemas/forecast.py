from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict


class SafeToSpendStatus(str, Enum):
    HEALTHY = "HEALTHY"
    CAUTION = "CAUTION"
    CRITICAL = "CRITICAL"


class SafeToSpendInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    daily_amount: Decimal
    days_remaining: int
    disposable_month_amount: Decimal
    upcoming_bills_amount: Decimal
    current_checking_balance: Decimal
    status: SafeToSpendStatus
    message: str


class ForecastDailyPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date
    label: str  # ex: "13/Nov"
    day_number: int  # 1..31
    projected_balance: Decimal
    inflow: Decimal
    outflow: Decimal
    is_negative: bool


class CashFlowForecastResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_date: date
    end_date: date
    initial_balance: Decimal
    thirty_days_balance: Decimal
    end_of_month_balance: Decimal
    lowest_projected_balance: Decimal
    has_deficit_risk: bool
    deficit_date: date | None
    points: list[ForecastDailyPoint]
    safe_to_spend: SafeToSpendInfo
