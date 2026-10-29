from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from pywebpush import WebPushException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.account import Account, AccountType
from app.models.credit_card_bill import BillStatus, CreditCardBill
from app.schemas.push_notification import PushSubscriptionCreate, PushSubscriptionKeys
from app.services import web_push_service


@pytest.mark.asyncio
async def test_get_vapid_public_key(client: AsyncClient):
    """
    Testa obtenção da chave pública VAPID para registro do Service Worker.
    """
    res = await client.get("/api/v1/push/vapid-public-key")
    assert res.status_code == 200
    data = res.json()
    assert "public_key" in data
    assert data["public_key"] == settings.VAPID_PUBLIC_KEY


@pytest.mark.asyncio
async def test_subscribe_and_unsubscribe_lifecycle(client: AsyncClient, db_session: AsyncSession):
    """
    Testa o ciclo de vida completo de inscrição, reativação idempotente e desinscrição Web Push.
    """
    endpoint = "https://fcm.googleapis.com/fcm/send/test-token-12345"
    payload = {
        "endpoint": endpoint,
        "keys": {
            "p256dh": "BNcRdreA...",
            "auth": "tBHx...",
        },
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    }

    # 1. Inscrição inicial
    res = await client.post("/api/v1/push/subscribe", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["endpoint"] == endpoint
    assert data["is_active"] is True
    assert data["user_agent"] == payload["user_agent"]

    # 2. Reinscrição (Idempotência com atualização de chave)
    payload["keys"]["auth"] = "new-auth-key-updated"
    res_update = await client.post("/api/v1/push/subscribe", json=payload)
    assert res_update.status_code == 200
    assert res_update.json()["id"] == data["id"]

    # 3. Desinscrição
    unsub_res = await client.post("/api/v1/push/unsubscribe", json={"endpoint": endpoint})
    assert unsub_res.status_code == 200
    assert unsub_res.json()["success"] is True

    # 4. Verifica no banco se ficou inativo
    active_subs = await web_push_service.get_active_subscriptions(db_session)
    assert not any(s.endpoint == endpoint for s in active_subs)


@pytest.mark.asyncio
async def test_send_test_push_mocked(client: AsyncClient, db_session: AsyncSession):
    """
    Testa o endpoint de disparo imediato de notificação push de teste com mock de pywebpush.
    """
    sub_data = PushSubscriptionCreate(
        endpoint="https://updates.push.services.mozilla.com/wpush/v2/test-subscriber",
        keys=PushSubscriptionKeys(p256dh="mock_p256dh", auth="mock_auth"),
        user_agent="Firefox Test Agent",
    )
    await web_push_service.save_or_update_subscription(db_session, sub_data)

    with patch("app.services.web_push_service._send_webpush_sync", return_value=True) as mock_send:
        res = await client.post("/api/v1/push/test", json={"title": "Teste Unitário", "body": "Mensagem OK"})
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["details"]["sent"] == 1
        assert mock_send.called


@pytest.mark.asyncio
async def test_due_bills_check_and_notify_d0_and_d1(client: AsyncClient, db_session: AsyncSession):
    """
    Valida a identificação precisa de faturas em D-0 (vencendo hoje) e D-1 (vencendo amanhã)
    no fuso de Brasília e o envio dos alertas correspondentes.
    """
    now_sp = datetime.now(ZoneInfo("America/Sao_Paulo"))
    today = now_sp.date()
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)

    # 1. Cria conta de Cartão de Crédito
    card_account = Account(
        name="Nubank Ultravioleta",
        type=AccountType.CREDIT_CARD,
        balance=Decimal("0.00"),
        credit_limit=Decimal("15000.00"),
    )
    db_session.add(card_account)
    await db_session.flush()

    # 2. Cria fatura D-0 (vencendo hoje, OPEN, valor R$ 850.50) -> DEVE ALERTAR
    bill_d0 = CreditCardBill(
        account_id=card_account.id,
        month=today.month,
        year=today.year,
        closing_date=today - timedelta(days=7),
        due_date=today,
        status=BillStatus.OPEN,
        total_amount=Decimal("850.50"),
    )

    # 3. Cria fatura D-1 (vencendo amanhã, CLOSED, valor R$ 2340.00) -> DEVE ALERTAR
    # Para evitar conflito da restrição de mês/ano único se amanhã for outro mês:
    bill_d1 = CreditCardBill(
        account_id=card_account.id,
        month=tomorrow.month if tomorrow.month != today.month else (today.month % 12) + 1,
        year=tomorrow.year if tomorrow.month != today.month else today.year + 1,
        closing_date=tomorrow - timedelta(days=7),
        due_date=tomorrow,
        status=BillStatus.CLOSED,
        total_amount=Decimal("2340.00"),
    )

    # 4. Fatura paga hoje (PAID) -> NÃO DEVE ALERTAR
    bill_paid = CreditCardBill(
        account_id=card_account.id,
        month=(today.month + 1) % 12 + 1,
        year=today.year + 2,
        closing_date=today - timedelta(days=10),
        due_date=today,
        status=BillStatus.PAID,
        total_amount=Decimal("100.00"),
    )

    # 5. Fatura futura em D-7 -> NÃO DEVE ALERTAR
    bill_future = CreditCardBill(
        account_id=card_account.id,
        month=(today.month + 2) % 12 + 1,
        year=today.year + 3,
        closing_date=next_week - timedelta(days=7),
        due_date=next_week,
        status=BillStatus.OPEN,
        total_amount=Decimal("300.00"),
    )

    db_session.add_all([bill_d0, bill_d1, bill_paid, bill_future])
    await db_session.commit()

    # Mock do envio de push para interceptar os payloads
    with patch(
        "app.services.web_push_service.broadcast_notification",
        return_value={"total": 1, "sent": 1, "failed": 0},
    ) as mock_broadcast:
        alerts = await web_push_service.check_due_bills_and_notify(db_session)

        # Devem ser gerados exatamente 2 alertas: 1 para D-0 e 1 para D-1
        assert len(alerts) == 2
        assert mock_broadcast.call_count == 2

        # Valida que os payloads contêm a formatação correta em Real (R$) e ícones
        d0_alert = next(a for a in alerts if a["is_today"] is True)
        assert d0_alert["account_name"] == "Nubank Ultravioleta"
        assert d0_alert["total_amount"] == "850.50"

        d1_alert = next(a for a in alerts if a["is_today"] is False)
        assert d1_alert["account_name"] == "Nubank Ultravioleta"
        assert d1_alert["total_amount"] == "2340.00"


@pytest.mark.asyncio
async def test_webpush_410_auto_deactivates_subscription(db_session: AsyncSession):
    """
    Verifica se uma resposta 410 Gone (inscrição revogada no dispositivo)
    desativa automaticamente o registro na base de dados para evitar requisições inúteis.
    """
    sub_data = PushSubscriptionCreate(
        endpoint="https://fcm.googleapis.com/fcm/send/expired-device-token",
        keys=PushSubscriptionKeys(p256dh="key1", auth="auth1"),
        user_agent="Chrome Android",
    )
    sub = await web_push_service.save_or_update_subscription(db_session, sub_data)
    assert sub.is_active is True

    # Cria exceção WebPushException com response.status_code = 410
    mock_response = MagicMock()
    mock_response.status_code = 410
    mock_exc = WebPushException("Push subscription has expired or is unsubscribed", response=mock_response)

    with patch("app.services.web_push_service._send_webpush_sync", side_effect=mock_exc):
        res = await web_push_service.send_single_notification(
            db_session,
            sub,
            {"title": "Test", "body": "Body"},
        )
        assert res is False
        assert sub.is_active is False
