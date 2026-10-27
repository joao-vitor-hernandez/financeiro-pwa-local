import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.transaction_service import process_transaction_creation

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    account_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transaction).order_by(
        Transaction.transaction_date.desc(), Transaction.created_at.desc()
    )
    if account_id:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "", response_model=list[TransactionResponse], status_code=status.HTTP_201_CREATED
)
async def create_transaction(
    tx_in: TransactionCreate, db: AsyncSession = Depends(get_db)
):
    """
    Cria uma ou mais transações financeiras aplicando regras contábeis:
    - Transação simples à vista
    - Transação parcelada (gera N parcelas conservando centavos exatos)
    - Transferência neutra (gera par débito/crédito)
    """
    transactions = await process_transaction_creation(session=db, data=tx_in)
    return transactions
