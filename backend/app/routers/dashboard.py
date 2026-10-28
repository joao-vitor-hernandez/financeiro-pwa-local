from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.summary import (
    CardExpensesResponse,
    DashboardSummary,
    SavingsEvolutionResponse,
)
from app.services.summary_service import (
    get_card_expenses_by_category,
    get_dashboard_summary,
    get_savings_evolution,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(ref_date: datetime | None = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Retorna os dados consolidados para os cards executivos do Dashboard.
    """
    target_date = ref_date or datetime.now(UTC)
    return await get_dashboard_summary(session=db, reference_date=target_date)


@router.get("/card-expenses", response_model=CardExpensesResponse)
async def get_card_expenses(
    ref_date: datetime | None = Query(None), db: AsyncSession = Depends(get_db)
):
    """
    Retorna a distribuição dinâmica de gastos em cartões de crédito agrupada por sessões/categorias
    para alimentar o gráfico Donut Chart interativo.
    """
    target_date = ref_date or datetime.now(UTC)
    return await get_card_expenses_by_category(session=db, reference_date=target_date)


@router.get("/savings-evolution", response_model=SavingsEvolutionResponse)
async def get_savings_growth(
    months: int = Query(6, ge=1, le=24),
    ref_date: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna o crescimento histórico do patrimônio guardado separado por:
    - Dinheiro na conta parado (Conta corrente/carteira)
    - Cofrinhos (Mercado Pago, Caixinhas, Reserva imediata)
    - Investido (Aplicações, CDB, Renda Fixa, Ações)
    - Total Consolidado
    """
    target_date = ref_date or datetime.now(UTC)
    return await get_savings_evolution(session=db, reference_date=target_date, months_count=months)

