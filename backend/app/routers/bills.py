import uuid
from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.account import Account
from app.models.credit_card_bill import BillStatus, CreditCardBill
from app.models.transaction import Transaction, TransactionType
from app.schemas.bill import CreditCardBillResponse
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/bills", tags=["Credit Card Bills"])


@router.get("/account/{account_id}", response_model=list[CreditCardBillResponse])
async def list_account_bills(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(CreditCardBill)
        .where(CreditCardBill.account_id == account_id)
        .order_by(CreditCardBill.year.desc(), CreditCardBill.month.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{bill_id}/transactions", response_model=list[TransactionResponse])
async def get_bill_transactions(bill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Transaction)
        .where(Transaction.bill_id == bill_id)
        .order_by(Transaction.transaction_date.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{bill_id}/pay", response_model=CreditCardBillResponse)
async def pay_credit_card_bill(
    bill_id: uuid.UUID,
    payment_account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Registra o pagamento da fatura de cartão de crédito:
    - Debita a conta de pagamento (Conta Corrente)
    - Altera o status da fatura para PAID
    - Gera uma transação de liquidação
    """
    stmt = select(CreditCardBill).where(CreditCardBill.id == bill_id)
    res = await db.execute(stmt)
    bill = res.scalars().first()
    if not bill:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")
    if bill.status == BillStatus.PAID:
        raise HTTPException(status_code=400, detail="Esta fatura já está paga.")

    # Conta de pagamento (onde o dinheiro sai)
    acc_stmt = select(Account).where(Account.id == payment_account_id)
    acc_res = await db.execute(acc_stmt)
    payment_acc = acc_res.scalars().first()
    if not payment_acc:
        raise HTTPException(status_code=404, detail="Conta de pagamento não encontrada.")

    # Cartão de crédito da fatura
    card_stmt = select(Account).where(Account.id == bill.account_id)
    card_res = await db.execute(card_stmt)
    card = card_res.scalars().first()

    # Debitar a conta corrente
    payment_acc.balance -= bill.total_amount
    bill.status = BillStatus.PAID

    # Lançamento contábil de pagamento
    from datetime import datetime

    tx = Transaction(
        account_id=payment_acc.id,
        description=f"Pagamento de fatura: {card.name} ({bill.month:02d}/{bill.year})",
        amount=bill.total_amount,
        transaction_date=datetime.now(UTC),
        type=TransactionType.EXPENSE,
        is_transfer=True,  # Transferência neutra (pagamento de passivo próprio)
        transfer_target_account_id=card.id,
    )
    db.add(tx)
    await db.flush()
    await db.refresh(bill)
    return bill
