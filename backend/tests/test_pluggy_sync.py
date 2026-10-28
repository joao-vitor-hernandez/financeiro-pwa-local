from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category, CategoryType
from app.services.sync_service import sync_single_account


@pytest.mark.asyncio
async def test_pluggy_sync_idempotency_and_rules(db_session: AsyncSession):
    # 1. Criar Categoria e Regra de Categorização
    transporte_cat = Category(name="Transporte", type=CategoryType.EXPENSE)
    db_session.add(transporte_cat)
    await db_session.flush()

    rule_uber = CategorizationRule(
        name="Regra Uber",
        pattern=r"(?i)uber",
        clean_description="Uber Viagens",
        category_id=transporte_cat.id,
        priority=1,
        is_active=True,
    )
    db_session.add(rule_uber)

    # 2. Criar Conta com pluggy_account_id
    acc = Account(
        name="Itaú Corrente",
        type=AccountType.CHECKING,
        balance=Decimal("1000.00"),
        currency="BRL",
        pluggy_account_id="pluggy_acc_12345",
    )
    db_session.add(acc)
    await db_session.commit()

    # 3. Payload simulado da Pluggy
    mock_pluggy_payload = {
        "results": [
            {
                "id": "tx_ext_001",
                "description": "PAG*UBER *TRIP RIDE",
                "amount": -25.50,  # Despesa de R$ 25,50
                "date": "2026-10-27T10:00:00.000Z",
                "status": "POSTED",
            },
            {
                "id": "tx_ext_002",
                "description": "DEPOSITO SALARIO",
                "amount": 2500.00,  # Receita de R$ 2.500,00
                "date": "2026-10-27T11:00:00.000Z",
                "status": "POSTED",
            },
        ]
    }

    # 4. Primeira Execução do Sync
    with patch(
        "app.services.sync_service.pluggy_client.fetch_transactions", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = mock_pluggy_payload
        result = await sync_single_account(session=db_session, account=acc)
        await db_session.commit()

    assert result["inserted"] == 2
    assert result["updated"] == 0
    assert result["total_processed"] == 2

    # Validar saldo da conta: 1000.00 - 25.50 + 2500.00 = 3474.50
    await db_session.refresh(acc)
    assert acc.balance == Decimal("3474.50")

    # 5. Segunda Execução com os mesmos dados (Teste de Idempotência)
    with patch(
        "app.services.sync_service.pluggy_client.fetch_transactions", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = mock_pluggy_payload
        second_result = await sync_single_account(session=db_session, account=acc)
        await db_session.commit()

    # Nenhuma transação duplicada inserida!
    assert second_result["inserted"] == 0
    assert second_result["updated"] == 2

    # Saldo deve permanecer exatamente inalterado
    await db_session.refresh(acc)
    assert acc.balance == Decimal("3474.50")


@pytest.mark.asyncio
async def test_rules_api_endpoints(client: AsyncClient):
    # Criar categoria
    cat_res = await client.post(
        "/api/v1/categories", json={"name": "Serviços Online", "type": "EXPENSE"}
    )
    cat_id = cat_res.json()["id"]

    # Criar Regra via API
    rule_res = await client.post(
        "/api/v1/rules",
        json={
            "name": "Spotify",
            "pattern": r"(?i)spotify",
            "clean_description": "Spotify Premium",
            "category_id": cat_id,
            "priority": 5,
        },
    )
    assert rule_res.status_code == 201
    rule_data = rule_res.json()
    assert rule_data["clean_description"] == "Spotify Premium"
    rule_id = rule_data["id"]

    # Listar regras
    list_res = await client.get("/api/v1/rules")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Atualizar regra
    patch_res = await client.patch(f"/api/v1/rules/{rule_id}", json={"priority": 1})
    assert patch_res.status_code == 200
    assert patch_res.json()["priority"] == 1

    # Deletar regra
    del_res = await client.delete(f"/api/v1/rules/{rule_id}")
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_pluggy_connect_token_endpoint(client: AsyncClient):
    with patch(
        "app.routers.sync.pluggy_client.create_connect_token", new_callable=AsyncMock
    ) as mock_token:
        mock_token.return_value = "mock_connect_token_xyz"
        res = await client.post("/api/v1/sync/connect-token")
        assert res.status_code == 200
        assert res.json() == {"accessToken": "mock_connect_token_xyz"}


@pytest.mark.asyncio
async def test_pluggy_item_connected_and_account_discovery(client: AsyncClient, db_session: AsyncSession):
    mock_accounts = [
        {
            "id": "pluggy_acc_checking_01",
            "name": "Nubank Conta",
            "type": "BANK",
            "balance": 1500.50,
            "currencyCode": "BRL",
        },
        {
            "id": "pluggy_acc_credit_02",
            "name": "Nubank Ultravioleta",
            "type": "CREDIT",
            "balance": 0.00,
            "currencyCode": "BRL",
            "creditData": {"creditLimit": 25000.00},
        },
    ]

    with patch(
        "app.routers.sync.pluggy_client.fetch_accounts", new_callable=AsyncMock
    ) as mock_fetch_acc, patch(
        "app.routers.sync.sync_all_accounts", new_callable=AsyncMock
    ) as mock_sync_all:
        mock_fetch_acc.return_value = mock_accounts
        mock_sync_all.return_value = []

        res = await client.post(
            "/api/v1/sync/item-connected",
            json={"itemId": "mock_item_123"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["accounts_created"] == 2

    # Verificar se as contas foram persistidas
    acc_res = await client.get("/api/v1/accounts")
    assert acc_res.status_code == 200
    saved = acc_res.json()
    names = [a["name"] for a in saved]
    assert "Nubank Conta" in names
    assert "Nubank Ultravioleta" in names


@pytest.mark.asyncio
async def test_pluggy_public_webhook_endpoint(unauth_client: AsyncClient):
    # Webhooks devem ser públicos (sem auth header) e responder HTTP 200 imediatamente
    webhook_payload = {
        "event": "transactions/created",
        "itemId": "item_pluggy_test_999",
        "eventId": "evt_123456",
    }
    with patch(
        "app.routers.webhooks._process_pluggy_webhook", new_callable=AsyncMock
    ) as mock_process:
        res = await unauth_client.post(
            "/api/v1/webhooks/pluggy",
            json=webhook_payload,
        )
        assert res.status_code == 200
        assert res.json() == {"received": True}
        assert mock_process.called

