from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.models.credit_card_bill import BillStatus, CreditCardBill
from app.models.push_subscription import PushSubscription
from app.schemas.push_notification import PushSubscriptionCreate

logger = logging.getLogger("web_push_service")


def format_currency_brl(value: Decimal) -> str:
    """
    Formata um valor Decimal no padrão monetário brasileiro (R$ 1.234,56).
    """
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


async def save_or_update_subscription(
    db: AsyncSession,
    sub_data: PushSubscriptionCreate,
    user_id: uuid.UUID | None = None,
) -> PushSubscription:
    """
    Salva ou atualiza a inscrição Web Push VAPID do PWA no PostgreSQL.
    Se o endpoint já existir, reativa e atualiza as chaves e o user_agent.
    """
    query = select(PushSubscription).where(PushSubscription.endpoint == sub_data.endpoint)
    result = await db.execute(query)
    existing_sub = result.scalar_one_or_none()

    if existing_sub:
        existing_sub.p256dh = sub_data.keys.p256dh
        existing_sub.auth = sub_data.keys.auth
        existing_sub.user_agent = sub_data.user_agent
        existing_sub.is_active = True
        if user_id:
            existing_sub.user_id = user_id
        await db.commit()
        await db.refresh(existing_sub)
        logger.info("Inscrição de push atualizada: id=%s", existing_sub.id)
        return existing_sub

    new_sub = PushSubscription(
        user_id=user_id,
        endpoint=sub_data.endpoint,
        p256dh=sub_data.keys.p256dh,
        auth=sub_data.keys.auth,
        user_agent=sub_data.user_agent,
        is_active=True,
    )
    db.add(new_sub)
    await db.commit()
    await db.refresh(new_sub)
    logger.info("Nova inscrição de push cadastrada: id=%s", new_sub.id)
    return new_sub


async def deactivate_subscription(db: AsyncSession, endpoint: str) -> bool:
    """
    Desativa uma inscrição de push pelo endpoint.
    """
    query = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    result = await db.execute(query)
    sub = result.scalar_one_or_none()
    if sub:
        sub.is_active = False
        await db.commit()
        logger.info("Inscrição de push desativada: id=%s", sub.id)
        return True
    return False


async def get_active_subscriptions(db: AsyncSession) -> list[PushSubscription]:
    """
    Retorna todas as inscrições de push ativas.
    """
    query = select(PushSubscription).where(PushSubscription.is_active.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


def _send_webpush_sync(subscription_info: dict, payload_str: str) -> bool:
    """
    Função de envio síncrono para ser executada em threadpool via asyncio.to_thread.
    """
    webpush(
        subscription_info=subscription_info,
        data=payload_str,
        vapid_private_key=settings.VAPID_PRIVATE_KEY,
        vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
        headers={"Urgency": "high"},
        ttl=86400,
    )
    return True


async def send_single_notification(
    db: AsyncSession,
    subscription: PushSubscription,
    payload: dict[str, Any] | str,
) -> bool:
    """
    Dispara uma notificação Web Push de alta prioridade para uma inscrição específica.
    Em caso de status 404/410 (inscrição expirada no navegador), marca como inativa.
    """
    payload_str = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }

    try:
        await asyncio.to_thread(_send_webpush_sync, subscription_info, payload_str)
        logger.info("Notificação Web Push enviada com sucesso para sub id=%s", subscription.id)
        return True
    except WebPushException as exc:
        status_code = getattr(exc.response, "status_code", None)
        logger.warning(
            "Falha ao enviar Web Push para sub id=%s: status=%s, erro=%s",
            subscription.id,
            status_code,
            exc,
        )
        # 404 (Not Found) ou 410 (Gone) indicam que a inscrição não existe mais no serviço do browser
        if status_code in (404, 410):
            subscription.is_active = False
            await db.commit()
            logger.info("Inscrição id=%s desativada automaticamente (código HTTP %s).", subscription.id, status_code)
        return False
    except Exception as exc:
        logger.error("Erro inesperado ao enviar Web Push: %s", exc, exc_info=True)
        return False


async def broadcast_notification(
    db: AsyncSession,
    payload: dict[str, Any] | str,
) -> dict[str, int]:
    """
    Envia uma notificação Web Push para todas as assinaturas ativas registradas.
    """
    subscriptions = await get_active_subscriptions(db)
    if not subscriptions:
        logger.info("Nenhuma inscrição de push ativa para broadcast.")
        return {"total": 0, "sent": 0, "failed": 0}

    sent = 0
    failed = 0
    for sub in subscriptions:
        success = await send_single_notification(db, sub, payload)
        if success:
            sent += 1
        else:
            failed += 1

    return {"total": len(subscriptions), "sent": sent, "failed": failed}


async def check_due_bills_and_notify(db: AsyncSession) -> list[dict[str, Any]]:
    """
    Rotina periódica de verificação de faturas de cartão de crédito.
    Executada às 09:00 e 18:00 no fuso de Brasília (America/Sao_Paulo).
    Dispara alertas de alta prioridade para faturas em D-0 (hoje) e D-1 (amanhã).
    """
    now_sp = datetime.now(ZoneInfo("America/Sao_Paulo"))
    today = now_sp.date()
    tomorrow = today + timedelta(days=1)

    logger.info(
        "Verificando vencimentos de faturas em %s (D-0=%s, D-1=%s)...",
        now_sp.strftime("%Y-%m-%d %H:%M:%S %Z"),
        today,
        tomorrow,
    )

    query = (
        select(CreditCardBill)
        .options(joinedload(CreditCardBill.account))
        .where(
            CreditCardBill.status.in_([BillStatus.OPEN, BillStatus.CLOSED]),
            CreditCardBill.due_date.in_([today, tomorrow]),
            CreditCardBill.total_amount > Decimal("0.00"),
        )
    )
    result = await db.execute(query)
    bills = result.scalars().all()

    if not bills:
        logger.info("Nenhuma fatura com vencimento para hoje ou amanhã encontrada.")
        return []

    dispatched_alerts: list[dict[str, Any]] = []

    for bill in bills:
        account_name = bill.account.name if bill.account else "Cartão de Crédito"
        amount_fmt = format_currency_brl(bill.total_amount)
        is_today = bill.due_date == today

        if is_today:
            title = f"🚨 Vencimento Hoje: {account_name}"
            body = (
                f"A fatura de {amount_fmt} vence hoje ({today.strftime('%d/%m')}). "
                "Evite juros e encargos!"
            )
        else:
            title = f"⏰ Vence Amanhã: {account_name}"
            body = (
                f"A fatura de {amount_fmt} vence amanhã ({tomorrow.strftime('%d/%m')}). "
                "Prepare o seu pagamento!"
            )

        notification_dict = {
            "title": title,
            "body": body,
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/icon-96x96.png",
            "tag": f"bill-due-{bill.id}-{bill.due_date.isoformat()}",
            "data": {
                "url": "/bills",
                "bill_id": str(bill.id),
                "account_name": account_name,
                "due_date": bill.due_date.isoformat(),
            },
            "vibrate": [200, 100, 200],
            "requireInteraction": True,
            "actions": [
                {"action": "open", "title": "Abrir no ClariFin"}
            ],
        }
        payload = {
            **notification_dict,
            "notification": notification_dict,
        }

        broadcast_res = await broadcast_notification(db, payload)
        dispatched_alerts.append({
            "bill_id": str(bill.id),
            "account_name": account_name,
            "due_date": bill.due_date.isoformat(),
            "total_amount": str(bill.total_amount),
            "is_today": is_today,
            "broadcast": broadcast_res,
        })
        logger.info(
            "Alerta de vencimento emitido: %s - %s (%s)",
            title,
            amount_fmt,
            broadcast_res,
        )

    return dispatched_alerts
