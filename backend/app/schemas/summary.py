from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    """
    Resumo consolidado para os cards de topo do Dashboard PWA.
    """

    total_checking_balance: Decimal  # Saldo livre em conta corrente/dinheiro
    total_investments: Decimal  # Saldo em investimentos/poupança
    current_card_bill: Decimal  # Fatura aberta do mês corrente
    total_credit_card_debt: (
        Decimal  # Total consolidado de todas as faturas abertas (passivo total futuro)
    )
    net_worth: Decimal  # Patrimônio líquido total (checking + investments - total debt)

    monthly_income: Decimal  # Entradas do mês corrente (excluindo transferências neutras)
    monthly_expenses: Decimal  # Saídas do mês corrente (excluindo transferências neutras)
    monthly_result: Decimal  # Resultado do mês (Receitas - Despesas)


class CategoryExpenseSegment(BaseModel):
    label: str
    value: Decimal
    percentage: float
    color: str
    count: int


class CardExpensesResponse(BaseModel):
    total_value: Decimal
    period: str
    segments: list[CategoryExpenseSegment]


class SavingsPoint(BaseModel):
    date: str  # ex: "2026-05"
    label: str  # ex: "Mai"
    checking: Decimal  # Dinheiro na conta parado
    savings: Decimal  # Cofrinhos (Mercado Pago, caixinhas)
    investment: Decimal  # Investido
    total: Decimal  # Total acumulado


class SavingsEvolutionResponse(BaseModel):
    current_total: Decimal
    current_checking: Decimal
    current_savings: Decimal
    current_investment: Decimal
    period_growth_amount: Decimal
    period_growth_percentage: float
    period: str  # ex: "Últimos 6 meses"
    points: list[SavingsPoint]

