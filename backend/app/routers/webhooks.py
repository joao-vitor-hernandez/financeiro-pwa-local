import logging
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.account import Account, AccountType
from app.services.pluggy_client import pluggy_client
from app.services.sync_service import sync_all_accounts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks Públicos"])


class PluggyWebhookPayload(BaseModel):
    event: str
    itemId: str | None = None
    eventId: str | None = None
    error: dict[str, Any] | None = None


async def _process_pluggy_webhook(event: str, item_id: str | None):
    """
    Processa eventos assíncronos da Pluggy em background.
    Garante que a resposta HTTP 200 seja devolvida em menos de 2 segundos para a Pluggy.
    """
    logger.info("Processando webhook da Pluggy em background: event=%s item_id=%s", event, item_id)
    if event in ("item/created", "item/updated", "transactions/created"):
        try:
            async with AsyncSessionLocal() as session:
                # Se veio itemId, descobre e cria contas novas se ainda não cadastradas
                if item_id:
                    try:
                        raw_accounts = await pluggy_client.fetch_accounts(item_id=item_id)
                        for acc in raw_accounts:
                            pluggy_acc_id = acc.get("id")
                            if not pluggy_acc_id:
                                continue

                            stmt = select(Account).where(Account.pluggy_account_id == pluggy_acc_id)
                            res = await session.execute(stmt)
                            existing = res.scalars().first()
                            if existing:
                                continue

                            acc_type_str = acc.get("type", "BANK")
                            if acc_type_str == "CREDIT":
                                acc_type = AccountType.CREDIT_CARD
                                credit_data = acc.get("creditData") or {}
                                credit_limit = Decimal(str(credit_data.get("creditLimit") or "0.00"))
                            else:
                                acc_type = AccountType.CHECKING
                                credit_limit = None

                            name = acc.get("name") or acc.get("marketingName") or "Conta Conectada"
                            balance = Decimal(str(acc.get("balance") or "0.00"))

                            new_acc = Account(
                                name=name,
                                type=acc_type,
                                balance=balance,
                                currency=acc.get("currencyCode", "BRL"),
                                credit_limit=credit_limit,
                                pluggy_account_id=pluggy_acc_id,
                                is_active=True,
                            )
                            session.add(new_acc)

                        await session.commit()
                    except Exception as err:
                        logger.warning("Não foi possível pré-cadastrar contas do item %s: %s", item_id, err)

                # Sincroniza lançamentos e atualiza saldos
                results = await sync_all_accounts(session=session)
                await session.commit()
                logger.info("Sincronização via webhook concluída com sucesso: %s", results)
        except Exception as exc:
            logger.error("Erro ao processar sincronização via webhook da Pluggy: %s", exc)


@router.post("/pluggy", status_code=status.HTTP_200_OK)
async def handle_pluggy_webhook(
    payload: PluggyWebhookPayload,
    background_tasks: BackgroundTasks,
):
    """
    Endpoint público que recebe notificações em tempo real da Pluggy.
    Responde instantaneamente com HTTP 200 e delega o processamento contábil para background tasks.
    """
    logger.info("Webhook recebido da Pluggy: event=%s eventId=%s itemId=%s", payload.event, payload.eventId, payload.itemId)

    # Dispara processamento em background para responder à Pluggy em milissegundos (< 5s requirement)
    background_tasks.add_task(_process_pluggy_webhook, payload.event, payload.itemId)

    return {"received": True}
