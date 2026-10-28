from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import and_, case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.category import Category
from app.models.credit_card_bill import BillStatus, CreditCardBill
from app.models.transaction import Transaction, TransactionType
from app.schemas.summary import (
    CardExpensesResponse,
    CategoryExpenseSegment,
    DashboardSummary,
    SavingsEvolutionResponse,
    SavingsPoint,
)


async def get_dashboard_summary(
    session: AsyncSession, reference_date: datetime
) -> DashboardSummary:
    """
    Calcula os indicadores financeiros consolidados para o Dashboard PWA.
    """
    ref_year = reference_date.year
    ref_month = reference_date.month

    # 1. Saldos em Contas Correntes e Carteira
    stmt_checking = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active == True,
        Account.type.in_([AccountType.CHECKING, AccountType.CASH]),
    )
    res_checking = await session.execute(stmt_checking)
    total_checking = res_checking.scalar_one()

    # 2. Saldos em Investimentos e Poupança
    stmt_investments = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active == True,
        Account.type.in_([AccountType.INVESTMENT, AccountType.SAVINGS]),
    )
    res_investments = await session.execute(stmt_investments)
    total_investments = res_investments.scalar_one()

    # 3. Dívida de Faturas de Cartão Abertas
    stmt_card_debt = select(
        func.coalesce(func.sum(CreditCardBill.total_amount), Decimal("0.00"))
    ).where(CreditCardBill.status == BillStatus.OPEN)
    res_card_debt = await session.execute(stmt_card_debt)
    total_card_debt = res_card_debt.scalar_one()

    # 3.1 Fatura aberta mais próxima a vencer (ciclo aberto atual)
    stmt_current_bill = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount), Decimal("0.00")))
        .where(CreditCardBill.status == BillStatus.OPEN)
        .where(
            CreditCardBill.due_date
            == (
                select(func.min(CreditCardBill.due_date))
                .where(CreditCardBill.status == BillStatus.OPEN)
                .scalar_subquery()
            )
        )
    )
    res_current_bill = await session.execute(stmt_current_bill)
    current_card_bill = res_current_bill.scalar_one()

    # 4. Patrimônio Líquido Consolidado (checking + investments - passivo total do cartão)
    net_worth = (total_checking + total_investments) - total_card_debt

    # 5. Receitas do Mês (Desconsiderando transferências neutras)
    stmt_income = select(func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))).where(
        and_(
            Transaction.type == TransactionType.INCOME,
            Transaction.is_transfer == False,
            extract("year", Transaction.transaction_date) == ref_year,
            extract("month", Transaction.transaction_date) == ref_month,
        )
    )
    res_income = await session.execute(stmt_income)
    monthly_income = res_income.scalar_one()

    # 6. Despesas do Mês (Desconsiderando transferências neutras)
    stmt_expenses = select(func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))).where(
        and_(
            Transaction.type == TransactionType.EXPENSE,
            Transaction.is_transfer == False,
            extract("year", Transaction.transaction_date) == ref_year,
            extract("month", Transaction.transaction_date) == ref_month,
        )
    )
    res_expenses = await session.execute(stmt_expenses)
    monthly_expenses = res_expenses.scalar_one()

    monthly_result = monthly_income - monthly_expenses

    return DashboardSummary(
        total_checking_balance=total_checking,
        total_investments=total_investments,
        current_card_bill=current_card_bill,
        total_credit_card_debt=total_card_debt,
        net_worth=net_worth,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        monthly_result=monthly_result,
    )


async def get_card_expenses_by_category(
    session: AsyncSession, reference_date: datetime | None = None
) -> CardExpensesResponse:
    """
    Agrupa os gastos de cartões de crédito por categoria/sessão para renderização
    dinâmica no Donut Chart interativo.
    """
    target_date = reference_date or datetime.now(UTC)
    ref_year = target_date.year
    ref_month = target_date.month

    # 1. Consulta despesas de cartões no mês de referência agrupadas por categoria
    stmt = (
        select(
            func.coalesce(Category.name, "Outros / Sem Categoria").label("category_name"),
            Category.color.label("category_color"),
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total_amount"),
            func.count(Transaction.id).label("tx_count"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Account.type == AccountType.CREDIT_CARD,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.is_transfer == False,
            extract("year", Transaction.transaction_date) == ref_year,
            extract("month", Transaction.transaction_date) == ref_month,
        )
        .group_by(Category.name, Category.color)
        .order_by(func.sum(Transaction.amount).desc())
    )
    res = await session.execute(stmt)
    rows = res.all()

    # 2. Se não houver despesas no mês corrente, consulta as faturas/despesas gerais mais recentes
    if not rows:
        stmt_fallback = (
            select(
                func.coalesce(Category.name, "Outros / Sem Categoria").label("category_name"),
                Category.color.label("category_color"),
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total_amount"),
                func.count(Transaction.id).label("tx_count"),
            )
            .join(Account, Transaction.account_id == Account.id)
            .outerjoin(Category, Transaction.category_id == Category.id)
            .where(
                Account.type == AccountType.CREDIT_CARD,
                Transaction.type == TransactionType.EXPENSE,
                Transaction.is_transfer == False,
            )
            .group_by(Category.name, Category.color)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(10)
        )
        res_fallback = await session.execute(stmt_fallback)
        rows = res_fallback.all()

    total_sum = sum((r.total_amount for r in rows), Decimal("0.00"))
    palette = [
        "#1DCDFE",  # Cyan ClariFin
        "#21D0B2",  # Teal ClariFin
        "#34F5C5",  # Mint ClariFin
        "#38bdf8",  # Sky Blue
        "#818cf8",  # Indigo
        "#a78bfa",  # Purple
        "#fbbf24",  # Amber
        "#fb7185",  # Rose
        "#94a3b8",  # Slate
    ]

    segments = []
    for idx, row in enumerate(rows):
        pct = float(row.total_amount / total_sum * 100) if total_sum > 0 else 0.0
        color = row.category_color or palette[idx % len(palette)]
        segments.append(
            CategoryExpenseSegment(
                label=row.category_name,
                value=row.total_amount,
                percentage=round(pct, 1),
                color=color,
                count=row.tx_count,
            )
        )

    period_str = f"{ref_month:02d}/{ref_year}"
    return CardExpensesResponse(
        total_value=total_sum,
        period=period_str,
        segments=segments,
    )


async def get_savings_evolution(
    session: AsyncSession, reference_date: datetime, months_count: int = 6
) -> SavingsEvolutionResponse:
    """
    Calcula a evolução histórica do dinheiro guardado (Conta Parado, Cofrinhos, Investido).
    """
    ref_year = reference_date.year
    ref_month = reference_date.month

    # 1. Saldos atuais consolidados por tipo de conta
    stmt_checking = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active == True,
        Account.type.in_([AccountType.CHECKING, AccountType.CASH]),
    )
    stmt_savings = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active == True,
        Account.type == AccountType.SAVINGS,
    )
    stmt_investment = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active == True,
        Account.type == AccountType.INVESTMENT,
    )

    current_checking = (await session.execute(stmt_checking)).scalar_one()
    current_savings = (await session.execute(stmt_savings)).scalar_one()
    current_investment = (await session.execute(stmt_investment)).scalar_one()
    current_total = current_checking + current_savings + current_investment

    # 2. Gerar pontos dos últimos N meses
    month_names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    month_slots: list[tuple[int, int]] = []
    curr_y = ref_year
    curr_m = ref_month
    for _ in range(months_count):
        month_slots.append((curr_y, curr_m))
        curr_m -= 1
        if curr_m < 1:
            curr_m = 12
            curr_y -= 1
    month_slots.reverse()

    points: list[SavingsPoint] = []

    if current_total == Decimal("0.00"):
        for y, m in month_slots:
            points.append(
                SavingsPoint(
                    date=f"{y:04d}-{m:02d}",
                    label=month_names[m - 1],
                    checking=Decimal("0.00"),
                    savings=Decimal("0.00"),
                    investment=Decimal("0.00"),
                    total=Decimal("0.00"),
                )
            )
        growth_amount = Decimal("0.00")
        growth_pct = 0.0
    else:
        # Busca fluxo líquido mensal por tipo de conta
        stmt_flow = (
            select(
                extract("year", Transaction.date).label("tx_year"),
                extract("month", Transaction.date).label("tx_month"),
                Account.type.label("acc_type"),
                func.sum(
                    case(
                        (Transaction.type == TransactionType.INCOME, Transaction.amount),
                        (Transaction.type == TransactionType.EXPENSE, -Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ).label("net_flow"),
            )
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Account.type.in_(
                    [AccountType.CHECKING, AccountType.CASH, AccountType.SAVINGS, AccountType.INVESTMENT]
                )
            )
            .group_by("tx_year", "tx_month", "acc_type")
        )
        flow_res = await session.execute(stmt_flow)
        flows = flow_res.all()
        flow_map = {(int(r.tx_year), int(r.tx_month), r.acc_type): r.net_flow for r in flows}

        running_checking = current_checking
        running_savings = current_savings
        running_investment = current_investment

        rev_points = []
        for y, m in reversed(month_slots):
            rev_points.append(
                SavingsPoint(
                    date=f"{y:04d}-{m:02d}",
                    label=month_names[m - 1],
                    checking=max(Decimal("0.00"), running_checking),
                    savings=max(Decimal("0.00"), running_savings),
                    investment=max(Decimal("0.00"), running_investment),
                    total=max(Decimal("0.00"), running_checking + running_savings + running_investment),
                )
            )
            flow_chk = (
                flow_map.get((y, m, AccountType.CHECKING), Decimal("0.00"))
                + flow_map.get((y, m, AccountType.CASH), Decimal("0.00"))
            )
            flow_sav = flow_map.get((y, m, AccountType.SAVINGS), Decimal("0.00"))
            flow_inv = flow_map.get((y, m, AccountType.INVESTMENT), Decimal("0.00"))

            running_checking = running_checking - flow_chk
            running_savings = running_savings - flow_sav
            running_investment = running_investment - flow_inv

        points = list(reversed(rev_points))
        start_total = points[0].total
        growth_amount = current_total - start_total
        growth_pct = float(growth_amount / start_total * 100) if start_total > 0 else 0.0

    return SavingsEvolutionResponse(
        current_total=current_total,
        current_checking=current_checking,
        current_savings=current_savings,
        current_investment=current_investment,
        period_growth_amount=growth_amount,
        period_growth_percentage=round(growth_pct, 1),
        period=f"Últimos {months_count} meses",
        points=points,
    )

