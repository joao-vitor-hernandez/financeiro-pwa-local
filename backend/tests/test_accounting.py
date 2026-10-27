from datetime import date, datetime
from decimal import Decimal

import pytest

from app.services.accounting import calculate_bill_dates, distribute_installments


def test_distribute_installments_exact_division():
    """Testa divisão exata sem dízima (R$ 100,00 em 2x)"""
    res = distribute_installments(Decimal("100.00"), 2)
    assert res == [Decimal("50.00"), Decimal("50.00")]
    assert sum(res) == Decimal("100.00")


def test_distribute_installments_with_residual_cents():
    """
    Testa divisão com dízima e conservação exata de centavos (R$ 100,00 em 3x).
    A primeira parcela deve absorver o centavo residual.
    """
    res = distribute_installments(Decimal("100.00"), 3)
    assert res == [Decimal("33.34"), Decimal("33.33"), Decimal("33.33")]
    assert sum(res) == Decimal("100.00")


def test_distribute_installments_complex_division():
    """Testa divisão complexa: R$ 1.000,00 em 7x"""
    total = Decimal("1000.00")
    res = distribute_installments(total, 7)
    assert len(res) == 7
    # A soma exata DEVE ser idêntica ao total
    assert sum(res) == total
    # As parcelas subsequentes devem ser rigorosamente iguais à base truncada
    assert res[1:] == [Decimal("142.85")] * 6
    assert res[0] == Decimal("142.90")  # 142.85 + 0.05 residual


def test_distribute_installments_single():
    """Testa compra de 1 parcela (à vista)"""
    res = distribute_installments(Decimal("250.75"), 1)
    assert res == [Decimal("250.75")]


def test_distribute_installments_invalid():
    """Testa exceção para parcelas <= 0"""
    with pytest.raises(ValueError):
        distribute_installments(Decimal("100.00"), 0)


def test_calculate_bill_dates_before_closing_day():
    """
    Cartão fecha dia 25 e vence dia 05 do próximo mês.
    Compra feita dia 10/10/2026 (antes do fechamento) -> cai na fatura que fecha em 25/10/2026 e vence em 05/11/2026.
    """
    tx_date = datetime(2026, 10, 10, 14, 30)
    closing_date, due_date, month, year = calculate_bill_dates(
        reference_date=tx_date, closing_day=25, due_day=5, installment_offset_months=0
    )
    assert closing_date == date(2026, 10, 25)
    assert due_date == date(2026, 11, 5)
    assert month == 11
    assert year == 2026


def test_calculate_bill_dates_after_closing_day():
    """
    Compra feita dia 26/10/2026 (após o fechamento do dia 25) -> cai na fatura do mês seguinte:
    Fecha em 25/11/2026 e vence em 05/12/2026.
    """
    tx_date = datetime(2026, 10, 26, 19, 0)
    closing_date, due_date, month, year = calculate_bill_dates(
        reference_date=tx_date, closing_day=25, due_day=5, installment_offset_months=0
    )
    assert closing_date == date(2026, 11, 25)
    assert due_date == date(2026, 12, 5)
    assert month == 12
    assert year == 2026
