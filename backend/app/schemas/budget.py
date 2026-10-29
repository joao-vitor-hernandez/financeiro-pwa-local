import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, condecimal

PositiveMoneyDecimal = condecimal(gt=Decimal("0.00"), max_digits=15, decimal_places=2)


class BudgetBase(BaseModel):
    category_id: uuid.UUID
    month: int = Field(..., ge=1, le=12, description="Mês de competência (1 a 12)")
    year: int = Field(..., ge=2020, le=2100, description="Ano de competência")
    limit_amount: PositiveMoneyDecimal = Field(
        ..., description="Teto estipulado de gastos (positivo e estritamente decimal)"
    )


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    limit_amount: PositiveMoneyDecimal = Field(
        ..., description="Novo teto estipulado de gastos"
    )


class BudgetCopyPreviousMonthRequest(BaseModel):
    source_month: int = Field(..., ge=1, le=12)
    source_year: int = Field(..., ge=2020, le=2100)
    target_month: int = Field(..., ge=1, le=12)
    target_year: int = Field(..., ge=2020, le=2100)


class BudgetResponse(BudgetBase):
    id: uuid.UUID
    category_name: str
    category_icon: str | None = None
    category_color: str | None = None
    spent_amount: Decimal = Field(..., description="Total consumido no mês na categoria")
    remaining_amount: Decimal = Field(..., description="Saldo restante do orçamento")
    percentage: Decimal = Field(..., description="Percentual consumido (0.0 a 100.0+)")
    status: str = Field(..., description="SAFE (<80%), WARNING (80-99%), EXCEEDED (>=100%)")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetSummaryResponse(BaseModel):
    month: int
    year: int
    total_budgeted: Decimal
    total_spent: Decimal
    total_remaining: Decimal
    overall_percentage: Decimal
    budgets: list[BudgetResponse]
    warning_count: int
    exceeded_count: int

