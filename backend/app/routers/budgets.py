from datetime import UTC, datetime
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.budget import (
    BudgetCopyPreviousMonthRequest,
    BudgetCreate,
    BudgetResponse,
    BudgetSummaryResponse,
    BudgetUpdate,
)
from app.services.budget_service import (
    copy_budgets_from_previous_month,
    create_or_upsert_budget,
    delete_budget,
    get_monthly_budgets_summary,
    update_budget_limit,
)

router = APIRouter(prefix="/budgets", tags=["Orçamentos & Tetos (Budgeting)"])


@router.get("", response_model=BudgetSummaryResponse)
async def list_budgets(
    month: int | None = Query(None, ge=1, le=12, description="Mês de competência (1-12)"),
    year: int | None = Query(None, ge=2020, le=2100, description="Ano de competência"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna o resumo executivo e a listagem de todos os orçamentos do mês selecionado,
    com consumo real por categoria, percentual e status semafórico (SAFE, WARNING, EXCEEDED).
    """
    now = datetime.now(UTC)
    target_month = month or now.month
    target_year = year or now.year

    return await get_monthly_budgets_summary(db, month=target_month, year=target_year)


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Cria ou atualiza (upsert) um teto de gastos orçamentário para uma categoria específica no mês/ano.
    """
    return await create_or_upsert_budget(db, data=payload)


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Atualiza o limite estipulado de um orçamento existente.
    """
    return await update_budget_limit(db, budget_id=budget_id, data=payload)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_budget(
    budget_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Exclui um orçamento cadastrado.
    """
    await delete_budget(db, budget_id=budget_id)
    return None


@router.post("/copy-previous-month", response_model=BudgetSummaryResponse)
async def copy_budgets(
    payload: BudgetCopyPreviousMonthRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Copia os limites de orçamento de um mês de origem (ex: mês anterior) para o mês de destino,
    sem sobrescrever categorias que já tenham sido personalizadas no mês alvo.
    """
    return await copy_budgets_from_previous_month(db, data=payload)

