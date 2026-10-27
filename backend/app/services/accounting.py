import calendar
from datetime import date, datetime
from decimal import ROUND_FLOOR, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.credit_card_bill import BillStatus, CreditCardBill


def distribute_installments(total_amount: Decimal, num_installments: int) -> list[Decimal]:
    """
    Divide um valor monetário em N parcelas com conservação matemática exata de centavos.

    A menor unidade monetária é o centavo (R$ 0,01).
    A diferença de arredondamento residual é alocada na primeira parcela para garantir que:
    sum(parcelas) == total_amount exato.

    Exemplo: R$ 100,00 em 3x -> [33.34, 33.33, 33.33]
    """
    if num_installments <= 0:
        raise ValueError("O número de parcelas deve ser maior que zero.")
    if num_installments == 1:
        return [total_amount]

    # Parcela base truncada para baixo em centavos
    base_installment = (total_amount / Decimal(num_installments)).quantize(
        Decimal("0.01"), rounding=ROUND_FLOOR
    )

    # Diferença residual de centavos
    residual_cents = total_amount - (base_installment * Decimal(num_installments))

    installments = []
    for i in range(num_installments):
        if i == 0:
            # Primeira parcela absorve os centavos residuais
            installments.append(base_installment + residual_cents)
        else:
            installments.append(base_installment)

    return installments


def project_installment_date(base_date: datetime, offset_months: int) -> datetime:
    """
    Projeta a data de uma parcela futura mantendo o horário e ajustando o dia se o mês for mais curto.
    """
    if offset_months == 0:
        return base_date

    total_months = base_date.year * 12 + (base_date.month - 1) + offset_months
    target_year = total_months // 12
    target_month = (total_months % 12) + 1
    max_days = calendar.monthrange(target_year, target_month)[1]
    target_day = min(base_date.day, max_days)

    return base_date.replace(year=target_year, month=target_month, day=target_day)


def calculate_bill_dates(
    reference_date: datetime,
    closing_day: int,
    due_day: int,
    installment_offset_months: int = 0,
) -> tuple[date, date, int, int]:
    """
    Calcula as datas exatas de fechamento e vencimento de uma fatura de cartão de crédito.

    Regra Contábil:
    - Se a compra ocorreu até o dia de corte (closing_day), cai na fatura do ciclo atual.
    - Se a compra ocorreu após o dia de corte, cai na fatura do mês subsequente (ciclo seguinte).
    - installment_offset_months: avança meses para compras parceladas.

    Retorna: (closing_date, due_date, reference_month, reference_year)
    """
    ref_year = reference_date.year
    ref_month = reference_date.month
    tx_day = reference_date.day

    # Determinar se a transação já caiu na fatura do próximo mês
    month_offset = installment_offset_months
    if tx_day > closing_day:
        month_offset += 1

    # Calcular mês e ano da data de fechamento
    total_months = ref_year * 12 + (ref_month - 1) + month_offset
    close_year = total_months // 12
    close_month = (total_months % 12) + 1

    # Ajustar dia de fechamento caso o mês tenha menos dias (ex: 31 em fevereiro)
    max_days_in_close_month = calendar.monthrange(close_year, close_month)[1]
    effective_closing_day = min(closing_day, max_days_in_close_month)
    closing_date = date(close_year, close_month, effective_closing_day)

    # Determinar a data de vencimento
    # Se o dia de vencimento for menor ou igual ao dia de fechamento (ex: fecha dia 28, vence dia 05),
    # o vencimento ocorre no mês seguinte ao fechamento.
    due_year = close_year
    due_month = close_month
    if due_day <= closing_day:
        due_total_months = close_year * 12 + (close_month - 1) + 1
        due_year = due_total_months // 12
        due_month = (due_total_months % 12) + 1

    max_days_in_due_month = calendar.monthrange(due_year, due_month)[1]
    effective_due_day = min(due_day, max_days_in_due_month)
    due_date = date(due_year, due_month, effective_due_day)

    return closing_date, due_date, due_month, due_year


async def get_or_create_bill(
    session: AsyncSession,
    account: Account,
    tx_date: datetime,
    installment_offset_months: int = 0,
) -> CreditCardBill:
    """
    Obtém a fatura correspondente para um lançamento em cartão de crédito ou cria uma nova se inexistente.
    """
    if account.type != AccountType.CREDIT_CARD:
        raise ValueError("Apenas contas do tipo CREDIT_CARD possuem faturas.")
    if not account.closing_day or not account.due_day:
        raise ValueError(
            "O cartão deve ter dia de fechamento (closing_day) e vencimento (due_day) definidos."
        )

    closing_date, due_date, ref_month, ref_year = calculate_bill_dates(
        reference_date=tx_date,
        closing_day=account.closing_day,
        due_day=account.due_day,
        installment_offset_months=installment_offset_months,
    )

    stmt = select(CreditCardBill).where(
        CreditCardBill.account_id == account.id,
        CreditCardBill.month == ref_month,
        CreditCardBill.year == ref_year,
    )
    result = await session.execute(stmt)
    bill = result.scalars().first()

    if not bill:
        bill = CreditCardBill(
            account_id=account.id,
            month=ref_month,
            year=ref_year,
            closing_date=closing_date,
            due_date=due_date,
            status=BillStatus.OPEN,
            total_amount=Decimal("0.00"),
        )
        session.add(bill)
        await session.flush()

    return bill
