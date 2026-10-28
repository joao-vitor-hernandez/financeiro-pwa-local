import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.account import Account, AccountType
from app.services.pluggy_client import pluggy_client
from app.services.sync_service import sync_all_accounts, sync_single_account

router = APIRouter(prefix="/sync", tags=["Open Finance Sync"])


class ItemConnectedRequest(BaseModel):
    itemId: str


@router.get("/status")
async def get_sync_status():
    """
    Informa o status de configuração do conector Open Finance da Pluggy.
    """
    is_configured = bool(settings.PLUGGY_CLIENT_ID and settings.PLUGGY_CLIENT_SECRET)
    return {
        "service": "Pluggy Open Finance",
        "configured": is_configured,
        "base_url": settings.PLUGGY_BASE_URL,
    }


@router.post("/connect-token")
async def get_connect_token():
    """
    Gera um Connect Token temporário para inicialização do widget Pluggy Connect no frontend.
    """
    token = await pluggy_client.create_connect_token()
    return {"accessToken": token}


@router.post("/item-connected")
async def handle_item_connected(
    payload: ItemConnectedRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe o itemId retornado pelo Pluggy Connect após o consentimento bancário,
    cadastra as contas descobertas e dispara a primeira sincronização de extratos.
    """
    raw_accounts = await pluggy_client.fetch_accounts(item_id=payload.itemId)
    created_count = 0

    for acc in raw_accounts:
        pluggy_acc_id = acc.get("id")
        if not pluggy_acc_id:
            continue

        stmt = select(Account).where(Account.pluggy_account_id == pluggy_acc_id)
        res = await db.execute(stmt)
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
        db.add(new_acc)
        created_count += 1

    await db.commit()

    # Dispara a ingestão inicial de lançamentos
    await sync_all_accounts(session=db)

    return {
        "success": True,
        "accounts_created": created_count,
    }


@router.post("/pluggy")
async def trigger_pluggy_sync(
    account_id: uuid.UUID | None = Query(None),
    from_date: str | None = Query(None, description="Formato YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """
    Dispara a sincronização manual com o Open Finance sob demanda.
    Pode sincronizar uma conta específica ou todas as contas conectadas.
    """
    if account_id:
        stmt = select(Account).where(Account.id == account_id)
        res = await db.execute(stmt)
        account = res.scalars().first()
        if not account:
            raise HTTPException(status_code=404, detail="Conta não encontrada.")

        result = await sync_single_account(session=db, account=account, from_date=from_date)
        return result
    else:
        results = await sync_all_accounts(session=db, from_date=from_date)
        return {"accounts_synced": results}
