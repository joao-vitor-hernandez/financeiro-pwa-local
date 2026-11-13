from decimal import Decimal

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_summary_includes_safe_to_spend(client: AsyncClient):
    """
    Fase 8.2: Valida que o endpoint consolidado do dashboard inclui os indicadores Safe to Spend.
    """
    res = await client.get("/api/v1/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert "safe_to_spend_daily" in data
    assert "safe_to_spend_status" in data
    assert "safe_to_spend_days_remaining" in data
    assert data["safe_to_spend_status"] in ["HEALTHY", "CAUTION", "CRITICAL"]


@pytest.mark.asyncio
async def test_cash_flow_forecast_30_days_structure(client: AsyncClient):
    """
    Fase 8.1: Valida a projeção preditiva a 30 dias com 31 pontos diários e métricas de fechamento.
    """
    res = await client.get("/api/v1/dashboard/forecast")
    assert res.status_code == 200
    data = res.json()

    assert "start_date" in data
    assert "end_date" in data
    assert "points" in data
    assert len(data["points"]) == 31  # D+0 até D+30

    # Verifica o primeiro ponto (D+0)
    p0 = data["points"][0]
    assert "date" in p0
    assert "label" in p0
    assert "projected_balance" in p0
    assert "inflow" in p0
    assert "outflow" in p0
    assert "is_negative" in p0

    # Verifica safe_to_spend embutido
    safe = data["safe_to_spend"]
    assert "daily_amount" in safe
    assert "days_remaining" in safe
    assert "disposable_month_amount" in safe
    assert "upcoming_bills_amount" in safe
    assert "status" in safe
    assert safe["status"] in ["HEALTHY", "CAUTION", "CRITICAL"]


@pytest.mark.asyncio
async def test_safe_to_spend_healthy_and_critical_scenarios(client: AsyncClient):
    """
    Fase 8.1 & 8.2: Testa o impacto de saldo em conta e faturas no valor livre por dia.
    """
    # 1. Cria conta corrente com saldo generoso de R$ 3.000,00
    acc_res = await client.post(
        "/api/v1/accounts",
        json={"name": "Conta Corrente Teste Safe", "type": "CHECKING", "balance": "3000.00"},
    )
    assert acc_res.status_code == 201

    # 2. Consulta o forecast
    res = await client.get("/api/v1/dashboard/forecast")
    assert res.status_code == 200
    data = res.json()
    safe = data["safe_to_spend"]
    assert Decimal(safe["daily_amount"]) > Decimal("0.00")
    assert safe["status"] in ["HEALTHY", "CAUTION"]
    assert safe["days_remaining"] >= 1
