import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, condecimal

from app.models.financial_goal import GoalStatus

PositiveMoneyDecimal = condecimal(gt=Decimal("0.00"), max_digits=15, decimal_places=2)
MoneyDecimal = condecimal(max_digits=15, decimal_places=2)


class GoalContributionCreate(BaseModel):
    amount: MoneyDecimal = Field(
        ...,
        description="Valor do aporte (positivo) ou resgate (negativo)",
    )
    contribution_date: datetime | None = Field(
        default=None,
        description="Data do lançamento do aporte (default: agora)",
    )
    notes: str | None = Field(default=None, max_length=255)


class GoalContributionResponse(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    amount: Decimal
    contribution_date: datetime
    notes: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FinancialGoalBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    target_amount: PositiveMoneyDecimal = Field(
        ..., description="Valor total estipulado para a meta financeira"
    )
    deadline_date: date | None = Field(default=None, description="Data limite desejada para conclusão")
    account_id: uuid.UUID | None = Field(
        default=None, description="ID da conta SAVINGS / Cofrinho vinculada (opcional)"
    )
    auto_sync_account: bool = Field(
        default=False,
        description="Se true, o saldo da meta reflete diretamente o saldo da conta SAVINGS vinculada",
    )
    icon: str | None = Field(default="target", max_length=50)
    color: str | None = Field(default="#21D0B2", max_length=20)


class FinancialGoalCreate(FinancialGoalBase):
    initial_amount: MoneyDecimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        description="Aporte inicial ao criar a meta",
    )


class FinancialGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    target_amount: PositiveMoneyDecimal | None = None
    deadline_date: date | None = None
    account_id: uuid.UUID | None = None
    auto_sync_account: bool | None = None
    icon: str | None = None
    color: str | None = None
    status: GoalStatus | None = None


class FinancialGoalResponse(FinancialGoalBase):
    id: uuid.UUID
    current_amount: Decimal
    status: GoalStatus
    percentage: Decimal = Field(..., description="Progresso percentual alcançado")
    remaining_amount: Decimal = Field(..., description="Valor restante para atingir o objetivo")
    days_remaining: int | None = Field(
        default=None, description="Dias restantes até o prazo (se definido)"
    )
    monthly_pace_needed: Decimal | None = Field(
        default=None,
        description="Aporte mensal estimado necessário para atingir a meta no prazo",
    )
    account_name: str | None = None
    created_at: datetime
    updated_at: datetime
    contributions: list[GoalContributionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class FinancialGoalSummaryResponse(BaseModel):
    total_target: Decimal
    total_current: Decimal
    overall_percentage: Decimal
    goals_in_progress_count: int
    goals_completed_count: int
    goals: list[FinancialGoalResponse]

