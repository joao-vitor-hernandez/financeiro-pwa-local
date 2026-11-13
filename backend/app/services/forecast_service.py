import calendar
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.credit_card_bill import BillStatus, CreditCardBill
from app.models.transaction import Transaction, TransactionType
from app.schemas.forecast import (
    CashFlowForecastResponse,
    ForecastDailyPoint,
    SafeToSpendInfo,
    SafeToSpendStatus,
)

MONTH_PT_BR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


async def calculate_safe_to_spend(
    session: AsyncSession, reference_date: date | datetime | None = None
) -> SafeToSpendInfo:
    """
    Calcula o indicador 'Livre para Gastar por Dia' (Safe to Spend - Inspirado no Actual Budget).
    Fórmula: (Saldo em Contas Correntes - Faturas de Cartão a Vencer até o Fim do Mês) / Dias Restantes.
    """
    if reference_date is None:
        today = datetime.now(UTC).date()
    elif isinstance(reference_date, datetime):
        today = reference_date.date()
    else:
        today = reference_date

    # 1. Saldo em Contas Correntes e Carteira
    stmt_checking = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active.is_(True),
        Account.type.in_([AccountType.CHECKING, AccountType.CASH]),
    )
    res_checking = await session.execute(stmt_checking)
    total_checking: Decimal = res_checking.scalar_one() or Decimal("0.00")

    # 2. Dias restantes no mês corrente
    _, last_day = calendar.monthrange(today.year, today.month)
    end_of_month_date = date(today.year, today.month, last_day)
    days_remaining = max(1, (end_of_month_date - today).days + 1)

    # 3. Faturas de cartão com vencimento até o fim do mês corrente que ainda não foram liquidadas
    stmt_bills = select(func.coalesce(func.sum(CreditCardBill.total_amount), Decimal("0.00"))).where(
        CreditCardBill.status.in_([BillStatus.OPEN, BillStatus.CLOSED]),
        CreditCardBill.due_date >= today,
        CreditCardBill.due_date <= end_of_month_date,
    )
    res_bills = await session.execute(stmt_bills)
    upcoming_bills: Decimal = res_bills.scalar_one() or Decimal("0.00")

    # 4. Saldo disponível para o restante do mês
    disposable_month_amount = total_checking - upcoming_bills

    # 5. Cálculo do valor diário seguro e classificação semafórica
    if disposable_month_amount <= Decimal("0.00"):
        daily_amount = Decimal("0.00")
        status = SafeToSpendStatus.CRITICAL
        deficit = abs(disposable_month_amount)
        message = (
            f"Alerta: Faturas a vencer no mês superam o saldo em conta em R$ {deficit:,.2f}. "
            "Evite novos gastos sem aporte de receitas."
        )
    else:
        daily_amount = (disposable_month_amount / Decimal(days_remaining)).quantize(Decimal("0.01"))
        if daily_amount < Decimal("25.00"):
            status = SafeToSpendStatus.CAUTION
            message = "Orçamento diário reduzido para os dias restantes deste mês."
        else:
            status = SafeToSpendStatus.HEALTHY
            message = "Ritmo diário seguro sem comprometer faturas ou saldo de fechamento."

    return SafeToSpendInfo(
        daily_amount=daily_amount,
        days_remaining=days_remaining,
        disposable_month_amount=disposable_month_amount.quantize(Decimal("0.01")),
        upcoming_bills_amount=upcoming_bills.quantize(Decimal("0.01")),
        current_checking_balance=total_checking.quantize(Decimal("0.01")),
        status=status,
        message=message,
    )


async def calculate_cash_flow_forecast(
    session: AsyncSession, reference_date: date | datetime | None = None
) -> CashFlowForecastResponse:
    """
    Calcula a projeção preditiva de fluxo de caixa para 30 dias (Cash Flow Forecast - Inspirado no Firefly III).
    Projeta dia a dia a evolução do saldo disponível cruzando saldo em conta, vencimentos de faturas
    e médias de entradas/saídas diárias.
    """
    if reference_date is None:
        start_date = datetime.now(UTC).date()
    elif isinstance(reference_date, datetime):
        start_date = reference_date.date()
    else:
        start_date = reference_date

    end_date = start_date + timedelta(days=30)
    _, last_day_month = calendar.monthrange(start_date.year, start_date.month)
    end_of_month_date = date(start_date.year, start_date.month, last_day_month)

    # 1. Saldo inicial em contas líquidas
    stmt_checking = select(func.coalesce(func.sum(Account.balance), Decimal("0.00"))).where(
        Account.is_active.is_(True),
        Account.type.in_([AccountType.CHECKING, AccountType.CASH]),
    )
    res_checking = await session.execute(stmt_checking)
    initial_balance: Decimal = res_checking.scalar_one() or Decimal("0.00")

    # 2. Faturas de cartão com vencimento na janela de 30 dias
    stmt_future_bills = select(CreditCardBill).where(
        CreditCardBill.status.in_([BillStatus.OPEN, BillStatus.CLOSED]),
        CreditCardBill.due_date >= start_date,
        CreditCardBill.due_date <= end_date,
    )
    res_future_bills = await session.execute(stmt_future_bills)
    future_bills = res_future_bills.scalars().all()

    bills_by_date: dict[date, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for bill in future_bills:
        bills_by_date[bill.due_date] += bill.total_amount

    # 3. Média histórica de receitas e despesas não-cartão nos últimos 30 dias
    hist_start = start_date - timedelta(days=30)
    stmt_hist_exp = select(func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))).where(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.is_transfer.is_(False),
        Transaction.bill_id.is_(None),  # Ignora despesas já computadas em faturas de cartão
        Transaction.transaction_date >= datetime.combine(hist_start, datetime.min.time(), tzinfo=UTC),
        Transaction.transaction_date < datetime.combine(start_date, datetime.min.time(), tzinfo=UTC),
    )
    res_hist_exp = await session.execute(stmt_hist_exp)
    total_hist_exp: Decimal = res_hist_exp.scalar_one() or Decimal("0.00")
    daily_avg_expense = (total_hist_exp / Decimal("30")).quantize(Decimal("0.01"))

    stmt_hist_inc = select(func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))).where(
        Transaction.type == TransactionType.INCOME,
        Transaction.is_transfer.is_(False),
        Transaction.transaction_date >= datetime.combine(hist_start, datetime.min.time(), tzinfo=UTC),
        Transaction.transaction_date < datetime.combine(start_date, datetime.min.time(), tzinfo=UTC),
    )
    res_hist_inc = await session.execute(stmt_hist_inc)
    total_hist_inc: Decimal = res_hist_inc.scalar_one() or Decimal("0.00")
    daily_avg_income = (total_hist_inc / Decimal("30")).quantize(Decimal("0.01"))

    # 4. Projeção dia a dia (D+0 até D+30)
    running_balance = initial_balance
    lowest_balance = initial_balance
    has_deficit = False
    deficit_date: date | None = None
    end_of_month_balance = initial_balance
    points: list[ForecastDailyPoint] = []

    for day_offset in range(31):
        current_day = start_date + timedelta(days=day_offset)

        if day_offset == 0:
            # Em D+0, o saldo inicial já reflete o momento presente; aplicamos apenas faturas do próprio dia
            bill_outflow = bills_by_date.get(current_day, Decimal("0.00"))
            outflow = bill_outflow
            inflow = Decimal("0.00")
            running_balance -= bill_outflow
        else:
            bill_outflow = bills_by_date.get(current_day, Decimal("0.00"))
            outflow = bill_outflow + daily_avg_expense
            inflow = daily_avg_income
            running_balance = running_balance + inflow - outflow

        is_negative = running_balance < Decimal("0.00")
        if is_negative:
            has_deficit = True
            if deficit_date is None:
                deficit_date = current_day

        if running_balance < lowest_balance:
            lowest_balance = running_balance

        if current_day == end_of_month_date:
            end_of_month_balance = running_balance

        label = f"{current_day.day:02d}/{MONTH_PT_BR[current_day.month - 1]}"
        points.append(
            ForecastDailyPoint(
                date=current_day,
                label=label,
                day_number=current_day.day,
                projected_balance=running_balance.quantize(Decimal("0.01")),
                inflow=inflow.quantize(Decimal("0.01")),
                outflow=outflow.quantize(Decimal("0.01")),
                is_negative=is_negative,
            )
        )

    thirty_days_balance = running_balance.quantize(Decimal("0.01"))

    # 5. Indicador Safe to Spend integrado
    safe_to_spend = await calculate_safe_to_spend(session=session, reference_date=start_date)

    return CashFlowForecastResponse(
        start_date=start_date,
        end_date=end_date,
        initial_balance=initial_balance.quantize(Decimal("0.01")),
        thirty_days_balance=thirty_days_balance,
        end_of_month_balance=end_of_month_balance.quantize(Decimal("0.01")),
        lowest_projected_balance=lowest_balance.quantize(Decimal("0.01")),
        has_deficit_risk=has_deficit,
        deficit_date=deficit_date,
        points=points,
        safe_to_spend=safe_to_spend,
    )
