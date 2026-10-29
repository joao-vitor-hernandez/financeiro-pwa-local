import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.financial_goal import FinancialGoal, GoalContribution, GoalStatus
from app.schemas.financial_goal import (
    FinancialGoalCreate,
    FinancialGoalResponse,
    FinancialGoalSummaryResponse,
    FinancialGoalUpdate,
    GoalContributionCreate,
    GoalContributionResponse,
)


def compute_goal_metrics(
    target: Decimal, current: Decimal, deadline: date | None
) -> tuple[Decimal, Decimal, int | None, Decimal | None]:
    """
    Calcula:
    1. Percentual atingido (0.0% a 100%+)
    2. Saldo restante para conclusão
    3. Dias restantes até o prazo alvo
    4. Ritmo mensal necessário de economia para cumprir a meta no prazo
    """
    if target > Decimal("0.00"):
        percentage = ((current / target) * Decimal("100")).quantize(Decimal("0.1"))
    else:
        percentage = Decimal("0.0")

    remaining = max(Decimal("0.00"), target - current)

    days_remaining: int | None = None
    monthly_pace: Decimal | None = None

    if deadline:
        today = datetime.now(UTC).date()
        diff = (deadline - today).days
        days_remaining = max(0, diff)

        if remaining > Decimal("0.00") and days_remaining > 0:
            # Estima meses restantes com média de 30.4 dias/mês
            months = max(1, round(days_remaining / 30.4))
            monthly_pace = (remaining / Decimal(months)).quantize(Decimal("0.01"))
        elif remaining <= Decimal("0.00"):
            monthly_pace = Decimal("0.00")

    return percentage, remaining, days_remaining, monthly_pace


def build_goal_response(goal: FinancialGoal) -> FinancialGoalResponse:
    """
    Enriquece a entidade FinancialGoal para o schema de resposta executivo.
    """
    pct, rem, days, pace = compute_goal_metrics(
        goal.target_amount, goal.current_amount, goal.deadline_date
    )

    contributions_resp = [
        GoalContributionResponse(
            id=c.id,
            goal_id=c.goal_id,
            amount=c.amount,
            contribution_date=c.contribution_date,
            notes=c.notes,
            created_at=c.created_at,
        )
        for c in (goal.contributions or [])
    ]

    return FinancialGoalResponse(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        deadline_date=goal.deadline_date,
        account_id=goal.account_id,
        auto_sync_account=goal.auto_sync_account,
        icon=goal.icon,
        color=goal.color,
        status=goal.status,
        percentage=pct,
        remaining_amount=rem,
        days_remaining=days,
        monthly_pace_needed=pace,
        account_name=goal.account.name if goal.account else None,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        contributions=contributions_resp,
    )


async def list_goals_summary(session: AsyncSession) -> FinancialGoalSummaryResponse:
    """
    Retorna a listagem de todas as metas financeiras enriquecidas com seus indicadores
    e o consolidado de progresso patrimonial global.
    """
    stmt = (
        select(FinancialGoal)
        .options(selectinload(FinancialGoal.contributions))
        .order_by(FinancialGoal.created_at.desc())
    )
    result = await session.execute(stmt)
    goals = result.scalars().all()

    total_target = Decimal("0.00")
    total_current = Decimal("0.00")
    in_progress_count = 0
    completed_count = 0
    responses: list[FinancialGoalResponse] = []

    for g in goals:
        # Se configurado para sincronizar automaticamente com a conta vinculada
        if g.auto_sync_account and g.account:
            if g.current_amount != g.account.balance:
                g.current_amount = g.account.balance
                if (
                    g.current_amount >= g.target_amount
                    and g.status == GoalStatus.IN_PROGRESS
                ):
                    g.status = GoalStatus.COMPLETED

        total_target += g.target_amount
        total_current += g.current_amount

        if g.status == GoalStatus.COMPLETED:
            completed_count += 1
        elif g.status == GoalStatus.IN_PROGRESS:
            in_progress_count += 1

        responses.append(build_goal_response(g))

    await session.commit()

    overall_pct = (
        ((total_current / total_target) * Decimal("100")).quantize(Decimal("0.1"))
        if total_target > Decimal("0.00")
        else Decimal("0.0")
    )

    return FinancialGoalSummaryResponse(
        total_target=total_target,
        total_current=total_current,
        overall_percentage=overall_pct,
        goals_in_progress_count=in_progress_count,
        goals_completed_count=completed_count,
        goals=responses,
    )


async def create_goal(session: AsyncSession, data: FinancialGoalCreate) -> FinancialGoalResponse:
    """
    Cria uma nova meta financeira com suporte a aporte inicial ou sincronização de conta SAVINGS.
    """
    # Valida conta se fornecida
    if data.account_id:
        acc_stmt = select(Account).where(Account.id == data.account_id)
        acc_res = await session.execute(acc_stmt)
        account = acc_res.scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conta vinculada não encontrada.",
            )
        initial_curr = account.balance if data.auto_sync_account else data.initial_amount
    else:
        initial_curr = data.initial_amount

    initial_status = (
        GoalStatus.COMPLETED
        if initial_curr >= data.target_amount
        else GoalStatus.IN_PROGRESS
    )

    new_goal = FinancialGoal(
        name=data.name,
        description=data.description,
        target_amount=data.target_amount,
        current_amount=initial_curr,
        deadline_date=data.deadline_date,
        account_id=data.account_id,
        auto_sync_account=data.auto_sync_account,
        icon=data.icon or "target",
        color=data.color or "#21D0B2",
        status=initial_status,
    )
    session.add(new_goal)
    await session.flush()

    # Se houve aporte inicial avulso, registra histórico de contribuição
    if data.initial_amount > Decimal("0.00") and not data.auto_sync_account:
        contrib = GoalContribution(
            goal_id=new_goal.id,
            amount=data.initial_amount,
            contribution_date=datetime.now(UTC),
            notes="Aporte inicial ao cadastrar a meta",
        )
        session.add(contrib)

    await session.commit()
    await session.refresh(new_goal)

    # Recarrega com relacionamentos
    stmt = (
        select(FinancialGoal)
        .options(selectinload(FinancialGoal.contributions))
        .where(FinancialGoal.id == new_goal.id)
    )
    res = await session.execute(stmt)
    loaded_goal = res.scalar_one()

    return build_goal_response(loaded_goal)


async def get_goal_by_id(session: AsyncSession, goal_id: uuid.UUID) -> FinancialGoalResponse:
    """
    Retorna os detalhes de uma meta específica e seu histórico completo de aportes.
    """
    stmt = (
        select(FinancialGoal)
        .options(selectinload(FinancialGoal.contributions))
        .where(FinancialGoal.id == goal_id)
    )
    res = await session.execute(stmt)
    goal = res.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meta financeira não encontrada.",
        )

    return build_goal_response(goal)


async def update_goal(
    session: AsyncSession, goal_id: uuid.UUID, data: FinancialGoalUpdate
) -> FinancialGoalResponse:
    """
    Atualiza dados de uma meta financeira (nome, valor alvo, prazo, etc.).
    """
    stmt = (
        select(FinancialGoal)
        .options(selectinload(FinancialGoal.contributions))
        .where(FinancialGoal.id == goal_id)
    )
    res = await session.execute(stmt)
    goal = res.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meta financeira não encontrada.",
        )

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(goal, field, val)

    # Atualiza status se o saldo atingiu ou deixou de atingir a nova meta
    if goal.current_amount >= goal.target_amount:
        goal.status = GoalStatus.COMPLETED
    elif goal.status == GoalStatus.COMPLETED and goal.current_amount < goal.target_amount:
        goal.status = GoalStatus.IN_PROGRESS

    await session.commit()
    res = await session.execute(stmt)
    loaded = res.scalar_one()

    return build_goal_response(loaded)


async def add_contribution(
    session: AsyncSession, goal_id: uuid.UUID, data: GoalContributionCreate
) -> FinancialGoalResponse:
    """
    Registra um aporte (valor positivo) ou resgate (valor negativo) na meta financeira,
    atualizando seu saldo acumulado e status de conclusão automaticamente.
    """
    stmt = (
        select(FinancialGoal)
        .options(selectinload(FinancialGoal.contributions))
        .where(FinancialGoal.id == goal_id)
    )
    res = await session.execute(stmt)
    goal = res.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meta financeira não encontrada.",
        )

    contrib_date = data.contribution_date or datetime.now(UTC)
    contribution = GoalContribution(
        goal_id=goal.id,
        amount=data.amount,
        contribution_date=contrib_date,
        notes=data.notes,
    )
    session.add(contribution)

    # Atualiza saldo da meta
    goal.current_amount = max(Decimal("0.00"), goal.current_amount + data.amount)

    if goal.current_amount >= goal.target_amount:
        goal.status = GoalStatus.COMPLETED
    elif goal.status == GoalStatus.COMPLETED and goal.current_amount < goal.target_amount:
        goal.status = GoalStatus.IN_PROGRESS

    await session.commit()
    await session.refresh(goal)

    # Recarrega para incluir a nova contribuição na lista
    res_reloaded = await session.execute(stmt)
    loaded = res_reloaded.scalar_one()

    return build_goal_response(loaded)


async def delete_goal(session: AsyncSession, goal_id: uuid.UUID) -> None:
    """
    Remove uma meta financeira e todo o seu histórico de aportes (deleção em cascata).
    """
    stmt = select(FinancialGoal).where(FinancialGoal.id == goal_id)
    res = await session.execute(stmt)
    goal = res.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meta financeira não encontrada.",
        )

    await session.delete(goal)
    await session.commit()

