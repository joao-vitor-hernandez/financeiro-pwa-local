import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.financial_goal import (
    FinancialGoalCreate,
    FinancialGoalResponse,
    FinancialGoalSummaryResponse,
    FinancialGoalUpdate,
    GoalContributionCreate,
)
from app.services.goal_service import (
    add_contribution,
    create_goal,
    delete_goal,
    get_goal_by_id,
    list_goals_summary,
    update_goal,
)

router = APIRouter(prefix="/goals", tags=["Metas Financeiras & Objetivos (Fase 7.2)"])


@router.get("", response_model=FinancialGoalSummaryResponse)
async def list_goals(db: AsyncSession = Depends(get_db)):
    """
    Retorna a listagem executiva de todas as metas financeiras, progresso percentual,
    dias restantes para o prazo alvo e ritmo mensal de economia necessário.
    """
    return await list_goals_summary(db)


@router.post("", response_model=FinancialGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_new_goal(payload: FinancialGoalCreate, db: AsyncSession = Depends(get_db)):
    """
    Cadastra uma nova meta financeira (ex: Reserva de Emergência, Troca de Celular, Viagem)
    com aporte inicial opcional ou vínculo a uma conta SAVINGS.
    """
    return await create_goal(db, data=payload)


@router.get("/{goal_id}", response_model=FinancialGoalResponse)
async def get_goal_details(goal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Retorna os detalhes de uma meta específica e o histórico de seus aportes e resgates.
    """
    return await get_goal_by_id(db, goal_id=goal_id)


@router.patch("/{goal_id}", response_model=FinancialGoalResponse)
async def update_goal_details(
    goal_id: uuid.UUID, payload: FinancialGoalUpdate, db: AsyncSession = Depends(get_db)
):
    """
    Atualiza dados de uma meta financeira (nome, valor alvo, prazo, etc.).
    """
    return await update_goal(db, goal_id=goal_id, data=payload)


@router.post("/{goal_id}/contribute", response_model=FinancialGoalResponse)
async def record_goal_contribution(
    goal_id: uuid.UUID, payload: GoalContributionCreate, db: AsyncSession = Depends(get_db)
):
    """
    Registra um aporte (positivo) ou resgate (negativo) na meta financeira,
    atualizando seu progresso e histórico.
    """
    return await add_contribution(db, goal_id=goal_id, data=payload)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_goal(goal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Remove uma meta financeira e seu histórico de aportes.
    """
    await delete_goal(db, goal_id=goal_id)
    return None

