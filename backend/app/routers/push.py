from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_dependency import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.push_notification import (
    PushNotificationPayload,
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    PushTestRequest,
    VapidPublicKeyResponse,
)
from app.services import web_push_service

logger = logging.getLogger("push_router")

router = APIRouter(prefix="/push", tags=["Web Push Notifications"])


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key():
    """
    Retorna a chave pública VAPID do servidor para o Service Worker do PWA se inscrever no PushManager.
    """
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chave pública VAPID não configurada no servidor.",
        )
    return VapidPublicKeyResponse(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_push(
    sub_data: PushSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registra ou atualiza a inscrição Web Push do PWA do usuário logado.
    """
    sub = await web_push_service.save_or_update_subscription(
        db=db,
        sub_data=sub_data,
        user_id=current_user.id,
    )
    return sub


@router.post("/unsubscribe")
async def unsubscribe_push(
    request: UnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Desativa uma inscrição Web Push pelo endpoint.
    """
    success = await web_push_service.deactivate_subscription(db=db, endpoint=request.endpoint)
    return {"success": success, "message": "Inscrição desativada com sucesso" if success else "Inscrição não encontrada"}


@router.post("/test")
async def send_test_push(
    test_req: PushTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Dispara imediatamente uma notificação de teste de alta prioridade para verificar a entrega no dispositivo.
    """
    req = test_req or PushTestRequest()
    payload = PushNotificationPayload(
        title=req.title,
        body=req.body,
        data={"url": "/", "type": "test_alert"},
    ).to_webpush_dict()

    res = await web_push_service.broadcast_notification(db=db, payload=payload)
    return {
        "success": res["sent"] > 0 or res["total"] == 0,
        "details": res,
    }


@router.post("/trigger-due-check")
async def trigger_due_check(
    db: AsyncSession = Depends(get_db),
):
    """
    Dispara manualmente a checagem de faturas com vencimento em D-0 e D-1 e envio dos alertas push.
    Útil para testes operacionais ou conferências sob demanda.
    """
    alerts = await web_push_service.check_due_bills_and_notify(db=db)
    return {
        "success": True,
        "alerts_dispatched_count": len(alerts),
        "alerts": alerts,
    }
