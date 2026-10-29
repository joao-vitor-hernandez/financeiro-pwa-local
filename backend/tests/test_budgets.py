from datetime import UTC, datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_budget_and_list_summary(client: AsyncClient):
    """
    7.1: Criação de orçamento mensal por categoria e verificação do resumo executivo.
    """
    # 1. Cria categoria de despesa
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Supermercado", "type": "EXPENSE", "icon": "shopping-cart", "color": "#21D0B2"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    now = datetime.now(UTC)

    # 2. Cria orçamento de R$ 1.000,00 para o mês atual
    budget_res = await client.post(
        "/api/v1/budgets",
        json={
            "category_id": cat_id,
            "month": now.month,
            "year": now.year,
            "limit_amount": "1000.00",
        },
    )
    assert budget_res.status_code == 201
    budget_data = budget_res.json()
    assert budget_data["limit_amount"] == "1000.00"
    assert budget_data["category_name"] == "Supermercado"
    assert budget_data["spent_amount"] == "0.00"
    assert budget_data["remaining_amount"] == "1000.00"
    assert budget_data["percentage"] == "0.0"
    assert budget_data["status"] == "SAFE"

    # 3. Consulta a listagem com filtros
    list_res = await client.get(f"/api/v1/budgets?month={now.month}&year={now.year}")
    assert list_res.status_code == 200
    summary = list_res.json()
    assert summary["total_budgeted"] == "1000.00"
    assert summary["total_spent"] == "0.00"
    assert summary["total_remaining"] == "1000.00"
    assert len(summary["budgets"]) == 1


@pytest.mark.asyncio
async def test_budget_rejects_income_category(client: AsyncClient):
    """
    7.1: Orçamentos só podem ser definidos para categorias de despesa (EXPENSE).
    """
    inc_cat = await client.post(
        "/api/v1/categories",
        json={"name": "Salário Mensal", "type": "INCOME", "icon": "wallet", "color": "#1DCDFE"},
    )
    assert inc_cat.status_code == 201
    cat_id = inc_cat.json()["id"]

    res = await client.post(
        "/api/v1/budgets",
        json={
            "category_id": cat_id,
            "month": 10,
            "year": 2026,
            "limit_amount": "5000.00",
        },
    )
    assert res.status_code == 400
    assert "categorias de despesa" in res.json()["detail"]


@pytest.mark.asyncio
async def test_budget_semaphoric_status_progression(client: AsyncClient):
    """
    7.1: Validação do cálculo de consumo em tempo real com barra de progresso semafórica:
    - SAFE (< 80%)
    - WARNING (80% a 99.9%)
    - EXCEEDED (>= 100%)
    """
    now = datetime.now(UTC)

    # 1. Cria categoria e conta
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Restaurantes & Lazer", "type": "EXPENSE"},
    )
    cat_id = cat_res.json()["id"]

    acc_res = await client.post(
        "/api/v1/accounts",
        json={"name": "Conta Corrente", "type": "CHECKING", "initial_balance": "2000.00"},
    )
    acc_id = acc_res.json()["id"]

    # 2. Define teto de R$ 500,00
    await client.post(
        "/api/v1/budgets",
        json={
            "category_id": cat_id,
            "month": now.month,
            "year": now.year,
            "limit_amount": "500.00",
        },
    )

    # 3. Gasto de R$ 350,00 (70% do teto) -> SAFE
    await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "category_id": cat_id,
            "description": "Jantar Sexta",
            "amount": "350.00",
            "transaction_date": now.isoformat(),
            "type": "EXPENSE",
        },
    )

    res_safe = await client.get(f"/api/v1/budgets?month={now.month}&year={now.year}")
    budget_safe = res_safe.json()["budgets"][0]
    assert Decimal(budget_safe["spent_amount"]) == Decimal("350.00")
    assert Decimal(budget_safe["remaining_amount"]) == Decimal("150.00")
    assert Decimal(budget_safe["percentage"]) == Decimal("70.0")
    assert budget_safe["status"] == "SAFE"

    # 4. Gasto adicional de R$ 100,00 (Total R$ 450,00 = 90% do teto) -> WARNING
    await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "category_id": cat_id,
            "description": "Almoço Domingo",
            "amount": "100.00",
            "transaction_date": now.isoformat(),
            "type": "EXPENSE",
        },
    )

    res_warn = await client.get(f"/api/v1/budgets?month={now.month}&year={now.year}")
    budget_warn = res_warn.json()["budgets"][0]
    assert Decimal(budget_warn["spent_amount"]) == Decimal("450.00")
    assert Decimal(budget_warn["percentage"]) == Decimal("90.0")
    assert budget_warn["status"] == "WARNING"
    assert res_warn.json()["warning_count"] == 1

    # 5. Gasto adicional de R$ 100,00 (Total R$ 550,00 = 110% do teto) -> EXCEEDED
    await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "category_id": cat_id,
            "description": "Café",
            "amount": "100.00",
            "transaction_date": now.isoformat(),
            "type": "EXPENSE",
        },
    )

    res_exc = await client.get(f"/api/v1/budgets?month={now.month}&year={now.year}")
    budget_exc = res_exc.json()["budgets"][0]
    assert Decimal(budget_exc["spent_amount"]) == Decimal("550.00")
    assert Decimal(budget_exc["remaining_amount"]) == Decimal("-50.00")
    assert Decimal(budget_exc["percentage"]) == Decimal("110.0")
    assert budget_exc["status"] == "EXCEEDED"
    assert res_exc.json()["exceeded_count"] == 1


@pytest.mark.asyncio
async def test_budget_update_and_delete(client: AsyncClient):
    """
    7.1: Atualização e exclusão de orçamento.
    """
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Streaming", "type": "EXPENSE"},
    )
    cat_id = cat_res.json()["id"]

    create_res = await client.post(
        "/api/v1/budgets",
        json={"category_id": cat_id, "month": 11, "year": 2026, "limit_amount": "80.00"},
    )
    budget_id = create_res.json()["id"]

    # Atualiza o teto para R$ 120,00
    update_res = await client.patch(
        f"/api/v1/budgets/{budget_id}",
        json={"limit_amount": "120.00"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["limit_amount"] == "120.00"

    # Remove o orçamento
    del_res = await client.delete(f"/api/v1/budgets/{budget_id}")
    assert del_res.status_code == 204

    # Consulta novamente: deve estar vazio
    list_res = await client.get("/api/v1/budgets?month=11&year=2026")
    assert len(list_res.json()["budgets"]) == 0


@pytest.mark.asyncio
async def test_budget_copy_previous_month(client: AsyncClient):
    """
    7.1: Replicação de orçamentos de um mês para o outro (cópia sem sobrescrita).
    """
    # 1. Cria 2 categorias
    c1 = (await client.post("/api/v1/categories", json={"name": "Transporte", "type": "EXPENSE"})).json()["id"]
    c2 = (await client.post("/api/v1/categories", json={"name": "Saúde", "type": "EXPENSE"})).json()["id"]

    # 2. Define orçamentos em 08/2026
    await client.post("/api/v1/budgets", json={"category_id": c1, "month": 8, "year": 2026, "limit_amount": "300.00"})
    await client.post("/api/v1/budgets", json={"category_id": c2, "month": 8, "year": 2026, "limit_amount": "250.00"})

    # 3. Pré-define um orçamento personalizado de Transporte em 09/2026 com R$ 400,00
    await client.post("/api/v1/budgets", json={"category_id": c1, "month": 9, "year": 2026, "limit_amount": "400.00"})

    # 4. Copia de 08/2026 para 09/2026
    copy_res = await client.post(
        "/api/v1/budgets/copy-previous-month",
        json={
            "source_month": 8,
            "source_year": 2026,
            "target_month": 9,
            "target_year": 2026,
        },
    )
    assert copy_res.status_code == 200
    summary = copy_res.json()
    assert len(summary["budgets"]) == 2

    # Verifica que Saúde foi copiado com 250.00 e Transporte preservou a personalização de 400.00
    limits = {b["category_name"]: Decimal(b["limit_amount"]) for b in summary["budgets"]}
    assert limits["Saúde"] == Decimal("250.00")
    assert limits["Transporte"] == Decimal("400.00")

