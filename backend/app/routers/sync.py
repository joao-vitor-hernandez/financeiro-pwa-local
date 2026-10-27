import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.account import Account
from app.services.sync_service import sync_all_accounts, sync_single_account

router = APIRouter(prefix="/sync", tags=["Open Finance Sync"])


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
