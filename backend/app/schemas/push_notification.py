from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., description="Chave pública p256dh do cliente PWA")
    auth: str = Field(..., description="Segredo de autenticação auth do cliente PWA")


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., description="Endpoint de push emitido pelo navegador/push service")
    keys: PushSubscriptionKeys
    user_agent: str | None = Field(default=None, description="Identificação do navegador/dispositivo")


class PushSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    endpoint: str
    user_agent: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class VapidPublicKeyResponse(BaseModel):
    public_key: str = Field(..., description="Chave pública VAPID codificada em Base64URL")


class PushNotificationPayload(BaseModel):
    title: str
    body: str
    icon: str = "/icons/icon-192x192.png"
    badge: str = "/icons/icon-96x96.png"
    tag: str = "bill-due-alert"
    data: dict[str, Any] = Field(default_factory=lambda: {"url": "/"})
    vibrate: list[int] = Field(default_factory=lambda: [200, 100, 200])
    requireInteraction: bool = True
    actions: list[dict[str, str]] = Field(
        default_factory=lambda: [
            {"action": "open", "title": "Abrir no ClariFin"}
        ]
    )

    def to_webpush_dict(self) -> dict[str, Any]:
        """
        Gera o dicionário contendo campos planos e o objeto 'notification',
        assegurando compatibilidade total tanto com o ngsw-worker.js do Angular
        quanto com Service Workers padrão e navegadores mobile.
        """
        payload = self.model_dump()
        payload["notification"] = {
            "title": self.title,
            "body": self.body,
            "icon": self.icon,
            "badge": self.badge,
            "tag": self.tag,
            "data": self.data,
            "vibrate": self.vibrate,
            "requireInteraction": self.requireInteraction,
            "actions": self.actions,
        }
        return payload


class PushTestRequest(BaseModel):
    title: str = "🔔 Alerta de Teste ClariFin"
    body: str = "Suas notificações push de alta prioridade estão ativas e funcionando perfeitamente!"
