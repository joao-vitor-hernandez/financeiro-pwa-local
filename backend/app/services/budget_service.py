import calendar
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category, CategoryType
from app.models.transaction import Transaction, TransactionType
from app.schemas.budget import (
    BudgetCopyPreviousMonthRequest,
    BudgetCreate,
    BudgetResponse,
    BudgetSummaryResponse,
    BudgetUpdate,
)


def compute_budget_metrics(
    limit: Decimal, spent: Decimal
) -> tuple[Decimal, Decimal, str]:
    """
    Calcula matematicamente o saldo restante, o percentual de consumo e o status semafórico:
    - SAFE (Verde): consumo < 80%
    - WARNING (Amarelo): consumo entre 80% e 99.9%
    - EXCEEDED (Vermelho): consumo >= 100%
    """
    remaining = limit - spent
    if limit > Decimal("0.00"):
        percentage = ((spent / limit) * Decimal("100")).quantize(Decimal("0.1"))
    else:
        percentage = Decimal("0.0")

    if percentage >= Decimal("100.0"):
        budget_status = "EXCEEDED"
    elif percentage >= Decimal("80.0"):
        budget_status = "WARNING"
    else:
        budget_status = "SAFE"

    return remaining, percentage, budget_status


async def get_monthly_budgets_summary(
    session: AsyncSession, month: int, year: int
) -> BudgetSummaryResponse:
    """
    Retorna o resumo executivo de todos os orçamentos de um determinado mês e ano,
    cruzando em tempo real com as despesas reais registradas nas categorias correspondentes.
    """
    # 1. Busca todos os orçamentos do mês/ano
    stmt = (
        select(Budget)
        .where(Budget.month == month, Budget.year == year)
        .order_by(Budget.limit_amount.desc())
    )
    result = await session.execute(stmt)
    budgets = result.scalars().all()

    # 2. Busca gastos reais por categoria no mês/ano (apenas despesas efetivas, ignorando transferências)
    start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=UTC)
    last_day = calendar.monthrange(year, month)[1]
    end_date = datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=UTC)

    expenses_stmt = (
        select(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total_spent"),
        )
        .where(
            Transaction.type == TransactionType.EXPENSE,
            Transaction.is_transfer.is_(False),
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.category_id.is_not(None),
        )
        .group_by(Transaction.category_id)
    )
    expenses_result = await session.execute(expenses_stmt)
    expenses_map = {row.category_id: Decimal(str(row.total_spent)) for row in expenses_result}

    # 3. Enriquece os dados de cada orçamento
    budget_responses: list[BudgetResponse] = []
    total_budgeted = Decimal("0.00")
    total_spent = Decimal("0.00")
    warning_count = 0
    exceeded_count = 0

    for b in budgets:
        cat = b.category
        spent = expenses_map.get(b.category_id, Decimal("0.00"))
        remaining, percentage, b_status = compute_budget_metrics(b.limit_amount, spent)

        if b_status == "WARNING":
            warning_count += 1
        elif b_status == "EXCEEDED":
            exceeded_count += 1

        total_budgeted += b.limit_amount
        total_spent += spent

        budget_responses.append(
            BudgetResponse(
                id=b.id,
                category_id=b.category_id,
                category_name=cat.name if cat else "Categoria",
                category_icon=cat.icon if cat else None,
                category_color=cat.color if cat else None,
                month=b.month,
                year=b.year,
                limit_amount=b.limit_amount,
                spent_amount=spent,
                remaining_amount=remaining,
                percentage=percentage,
                status=b_status,
                created_at=b.created_at,
                updated_at=b.updated_at,
            )
        )

    total_remaining = total_budgeted - total_spent
    overall_percentage = (
        ((total_spent / total_budgeted) * Decimal("100")).quantize(Decimal("0.1"))
        if total_budgeted > Decimal("0.00")
        else Decimal("0.0")
    )

    return BudgetSummaryResponse(
        month=month,
        year=year,
        total_budgeted=total_budgeted,
        total_spent=total_spent,
        total_remaining=total_remaining,
        overall_percentage=overall_percentage,
        budgets=budget_responses,
        warning_count=warning_count,
        exceeded_count=exceeded_count,
    )


async def create_or_upsert_budget(
    session: AsyncSession, data: BudgetCreate
) -> BudgetResponse:
    """
    Cria ou atualiza um orçamento por categoria/mês/ano de forma idempotente.
    Valida se a categoria existe e se é do tipo EXPENSE.
    """
    # Validação da categoria
    cat_stmt = select(Category).where(Category.id == data.category_id)
    cat_result = await session.execute(cat_stmt)
    category = cat_result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria informada não encontrada.",
        )

    if category.type != CategoryType.EXPENSE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Orçamentos só podem ser vinculados a categorias de despesa (EXPENSE).",
        )

    # Verifica se já existe um orçamento para esta categoria/mês/ano
    stmt = select(Budget).where(
        Budget.category_id == data.category_id,
        Budget.month == data.month,
        Budget.year == data.year,
    )
    result = await session.execute(stmt)
    existing_budget = result.scalar_one_or_none()

    if existing_budget:
        existing_budget.limit_amount = data.limit_amount
        budget = existing_budget
    else:
        budget = Budget(
            category_id=data.category_id,
            month=data.month,
            year=data.year,
            limit_amount=data.limit_amount,
        )
        session.add(budget)

    await session.commit()
    await session.refresh(budget)

    # Calcula consumo atual
    summary = await get_monthly_budgets_summary(session, month=data.month, year=data.year)
    for b_resp in summary.budgets:
        if b_resp.id == budget.id:
            return b_resp

    remaining, percentage, b_status = compute_budget_metrics(budget.limit_amount, Decimal("0.00"))
    return BudgetResponse(
        id=budget.id,
        category_id=budget.category_id,
        category_name=category.name,
        category_icon=category.icon,
        category_color=category.color,
        month=budget.month,
        year=budget.year,
        limit_amount=budget.limit_amount,
        spent_amount=Decimal("0.00"),
        remaining_amount=remaining,
        percentage=percentage,
        status=b_status,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


async def update_budget_limit(
    session: AsyncSession, budget_id: uuid.UUID, data: BudgetUpdate
) -> BudgetResponse:
    """
    Atualiza o limite estipulado de um orçamento existente.
    """
    stmt = select(Budget).where(Budget.id == budget_id)
    result = await session.execute(stmt)
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orçamento não encontrado.",
        )

    budget.limit_amount = data.limit_amount
    await session.commit()
    await session.refresh(budget)

    summary = await get_monthly_budgets_summary(session, month=budget.month, year=budget.year)
    for b_resp in summary.budgets:
        if b_resp.id == budget.id:
            return b_resp

    category = budget.category
    remaining, percentage, b_status = compute_budget_metrics(budget.limit_amount, Decimal("0.00"))
    return BudgetResponse(
        id=budget.id,
        category_id=budget.category_id,
        category_name=category.name if category else "Categoria",
        category_icon=category.icon if category else None,
        category_color=category.color if category else None,
        month=budget.month,
        year=budget.year,
        limit_amount=budget.limit_amount,
        spent_amount=Decimal("0.00"),
        remaining_amount=remaining,
        percentage=percentage,
        status=b_status,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


async def delete_budget(session: AsyncSession, budget_id: uuid.UUID) -> None:
    """
    Remove um orçamento cadastrado.
    """
    stmt = select(Budget).where(Budget.id == budget_id)
    result = await session.execute(stmt)
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orçamento não encontrado.",
        )

    await session.delete(budget)
    await session.commit()


async def copy_budgets_from_previous_month(
    session: AsyncSession, data: BudgetCopyPreviousMonthRequest
) -> BudgetSummaryResponse:
    """
    Copia os tetos orçamentários do mês de origem para o mês de destino.
    Não sobrescreve orçamentos já existentes no mês de destino para preservar personalizações manuais.
    """
    source_stmt = select(Budget).where(
        Budget.month == data.source_month, Budget.year == data.source_year
    )
    source_result = await session.execute(source_stmt)
    source_budgets = source_result.scalars().all()

    if not source_budgets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nenhum orçamento encontrado para copiar do período {data.source_month:02d}/{data.source_year}.",
        )

    # Busca os orçamentos que já existem no mês de destino
    target_stmt = select(Budget.category_id).where(
        Budget.month == data.target_month, Budget.year == data.target_year
    )
    target_result = await session.execute(target_stmt)
    existing_categories = set(target_result.scalars().all())

    copied_count = 0
    for src in source_budgets:
        if src.category_id not in existing_categories:
            new_budget = Budget(
                category_id=src.category_id,
                month=data.target_month,
                year=data.target_year,
                limit_amount=src.limit_amount,
            )
            session.add(new_budget)
            copied_count += 1

    if copied_count > 0:
        await session.commit()

    return await get_monthly_budgets_summary(
        session, month=data.target_month, year=data.target_year
    )

