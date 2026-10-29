from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_goal_with_initial_contribution_and_metrics(client: AsyncClient):
    """
    7.2: Criação de meta com aporte inicial, cálculo de percentual, dias restantes e ritmo mensal.
    """
    future_deadline = (datetime.now(UTC) + timedelta(days=365)).date()

    res = await client.post(
        "/api/v1/goals",
        json={
            "name": "Reserva de Emergência",
            "description": "6 meses de custo fixo",
            "target_amount": "12000.00",
            "initial_amount": "3000.00",
            "deadline_date": future_deadline.isoformat(),
            "icon": "shield",
            "color": "#21D0B2",
        },
    )
    assert res.status_code == 201
    goal = res.json()
    assert goal["name"] == "Reserva de Emergência"
    assert Decimal(goal["target_amount"]) == Decimal("12000.00")
    assert Decimal(goal["current_amount"]) == Decimal("3000.00")
    assert Decimal(goal["remaining_amount"]) == Decimal("9000.00")
    assert Decimal(goal["percentage"]) == Decimal("25.0")
    assert goal["status"] == "IN_PROGRESS"
    assert goal["days_remaining"] >= 364
    assert Decimal(goal["monthly_pace_needed"]) > Decimal("0.00")
    assert len(goal["contributions"]) == 1
    assert Decimal(goal["contributions"][0]["amount"]) == Decimal("3000.00")

    # Verifica na listagem de resumo
    list_res = await client.get("/api/v1/goals")
    assert list_res.status_code == 200
    summary = list_res.json()
    assert Decimal(summary["total_target"]) == Decimal("12000.00")
    assert Decimal(summary["total_current"]) == Decimal("3000.00")
    assert Decimal(summary["overall_percentage"]) == Decimal("25.0")
    assert summary["goals_in_progress_count"] == 1
    assert summary["goals_completed_count"] == 0


@pytest.mark.asyncio
async def test_goal_contributions_and_auto_completion(client: AsyncClient):
    """
    7.2: Aporte sequencial, conclusão automática ao atingir teto e reabertura em caso de resgate.
    """
    create_res = await client.post(
        "/api/v1/goals",
        json={
            "name": "Viagem Férias",
            "target_amount": "5000.00",
            "initial_amount": "0.00",
        },
    )
    goal_id = create_res.json()["id"]

    # 1. Primeiro aporte de R$ 3.000,00 (60%)
    c1 = await client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        json={"amount": "3000.00", "notes": "Aporte 13º Salário"},
    )
    assert c1.status_code == 200
    assert Decimal(c1.json()["current_amount"]) == Decimal("3000.00")
    assert Decimal(c1.json()["percentage"]) == Decimal("60.0")
    assert c1.json()["status"] == "IN_PROGRESS"

    # 2. Segundo aporte de R$ 2.000,00 (Total R$ 5.000,00 = 100%) -> Status COMPLETED
    c2 = await client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        json={"amount": "2000.00", "notes": "Bônus semestral"},
    )
    assert c2.status_code == 200
    assert Decimal(c2.json()["current_amount"]) == Decimal("5000.00")
    assert Decimal(c2.json()["percentage"]) == Decimal("100.0")
    assert c2.json()["status"] == "COMPLETED"

    # 3. Resgate parcial de R$ 1.000,00 (Saldo cai para R$ 4.000,00 = 80%) -> Retorna a IN_PROGRESS
    c3 = await client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        json={"amount": "-1000.00", "notes": "Resgate imprevisto"},
    )
    assert c3.status_code == 200
    assert Decimal(c3.json()["current_amount"]) == Decimal("4000.00")
    assert Decimal(c3.json()["percentage"]) == Decimal("80.0")
    assert c3.json()["status"] == "IN_PROGRESS"
    assert len(c3.json()["contributions"]) == 3


@pytest.mark.asyncio
async def test_goal_auto_sync_with_savings_account(client: AsyncClient):
    """
    7.2: Vínculo automático da meta com conta do tipo SAVINGS (cofrinho/caixinha).
    """
    acc_res = await client.post(
        "/api/v1/accounts",
        json={
            "name": "Cofrinho Mercado Pago",
            "type": "SAVINGS",
            "initial_balance": "4250.00",
        },
    )
    acc_id = acc_res.json()["id"]

    goal_res = await client.post(
        "/api/v1/goals",
        json={
            "name": "Meta Cofrinho Mercado Pago",
            "target_amount": "5000.00",
            "account_id": acc_id,
            "auto_sync_account": True,
        },
    )
    assert goal_res.status_code == 201
    goal = goal_res.json()
    assert Decimal(goal["current_amount"]) == Decimal("4250.00")
    assert Decimal(goal["percentage"]) == Decimal("85.0")
    assert goal["account_name"] == "Cofrinho Mercado Pago"


@pytest.mark.asyncio
async def test_goal_update_and_delete(client: AsyncClient):
    """
    7.2: Atualização de meta e exclusão com cascade nos aportes.
    """
    create_res = await client.post(
        "/api/v1/goals",
        json={"name": "Troca de Notebook", "target_amount": "8000.00"},
    )
    goal_id = create_res.json()["id"]

    # Atualiza valor alvo
    patch_res = await client.patch(
        f"/api/v1/goals/{goal_id}",
        json={"target_amount": "7500.00", "description": "MacBook Air M3"},
    )
    assert patch_res.status_code == 200
    assert Decimal(patch_res.json()["target_amount"]) == Decimal("7500.00")
    assert patch_res.json()["description"] == "MacBook Air M3"

    # Remove meta
    del_res = await client.delete(f"/api/v1/goals/{goal_id}")
    assert del_res.status_code == 204

    # Consulta detalhes após exclusão -> 404
    get_res = await client.get(f"/api/v1/goals/{goal_id}")
    assert get_res.status_code == 404

