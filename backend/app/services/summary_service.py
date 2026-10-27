from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.credit_card_bill import BillStatus, CreditCardBill
from app.models.transaction import Transaction, TransactionType
from app.schemas.summary import DashboardSummary


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
