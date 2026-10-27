import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from app.schemas.transaction import TransactionCreate
from app.services.accounting import (
    distribute_installments,
    get_or_create_bill,
    project_installment_date,
)


async def process_transaction_creation(
    session: AsyncSession, data: TransactionCreate
) -> list[Transaction]:
    """
    Orquestra a criação de transações aplicando regras de precisão contábil,
    partidas dobradas (transferências) e parcelamentos em faturas de cartão.
    """
    # 1. Buscar a conta principal
    stmt = select(Account).where(Account.id == data.account_id)
    res = await session.execute(stmt)
    account = res.scalars().first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta de origem não encontrada.",
        )

    # 2. Caso: Transferência Neutra entre Contas Próprias (Partidas Dobradas)
    if data.is_transfer:
        if not data.transfer_target_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para transferências, a conta de destino é obrigatória.",
            )
        if data.transfer_target_account_id == data.account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A conta de origem e destino não podem ser a mesma.",
            )

        target_stmt = select(Account).where(Account.id == data.transfer_target_account_id)
        target_res = await session.execute(target_stmt)
        target_account = target_res.scalars().first()
        if not target_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conta de destino não encontrada.",
            )

        # Atualizar saldos das contas
        account.balance -= data.amount
        target_account.balance += data.amount

        pair_id = uuid.uuid4()

        # Perna 1: Débito na conta de origem
        tx_debit = Transaction(
            account_id=account.id,
            category_id=data.category_id,
            description=f"Transferência para {target_account.name}: {data.description}",
            amount=data.amount,
            transaction_date=data.transaction_date,
            type=TransactionType.EXPENSE,
            is_transfer=True,
            transfer_target_account_id=target_account.id,
            transfer_pair_id=pair_id,
        )

        # Perna 2: Crédito na conta de destino
        tx_credit = Transaction(
            account_id=target_account.id,
            category_id=data.category_id,
            description=f"Transferência recebida de {account.name}: {data.description}",
            amount=data.amount,
            transaction_date=data.transaction_date,
            type=TransactionType.INCOME,
            is_transfer=True,
            transfer_target_account_id=account.id,
            transfer_pair_id=pair_id,
        )

        session.add_all([tx_debit, tx_credit])
        await session.flush()
        return [tx_debit, tx_credit]

    # 3. Caso: Compras Parceladas (N parcelas)
    if data.installments > 1:
        if account.type != AccountType.CREDIT_CARD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Compras parceladas são suportadas exclusivamente em contas de Cartão de Crédito.",
            )

        installment_values = distribute_installments(data.amount, data.installments)
        group_id = uuid.uuid4()
        created_transactions: list[Transaction] = []

        for idx, installment_amount in enumerate(installment_values):
            installment_num = idx + 1
            installment_date = project_installment_date(data.transaction_date, idx)

            bill = await get_or_create_bill(
                session=session,
                account=account,
                tx_date=data.transaction_date,
                installment_offset_months=idx,
            )

            # Incrementar o total da fatura
            bill.total_amount += installment_amount

            tx = Transaction(
                account_id=account.id,
                category_id=data.category_id,
                bill_id=bill.id,
                description=f"{data.description} ({installment_num}/{data.installments})",
                amount=installment_amount,
                transaction_date=installment_date,
                type=data.type,
                is_transfer=False,
                installment_number=installment_num,
                total_installments=data.installments,
                installment_identifier=group_id,
            )
            created_transactions.append(tx)

        session.add_all(created_transactions)
        await session.flush()
        return created_transactions

    # 4. Caso: Transação Simples (À vista)
    bill_id = None
    if account.type == AccountType.CREDIT_CARD:
        bill = await get_or_create_bill(
            session=session,
            account=account,
            tx_date=data.transaction_date,
            installment_offset_months=0,
        )
        bill.total_amount += data.amount
        bill_id = bill.id
    else:
        # Conta corrente, carteira, poupança: atualiza o saldo líquido em tempo real
        if data.type == TransactionType.INCOME:
            account.balance += data.amount
        else:
            account.balance -= data.amount

    tx = Transaction(
        account_id=account.id,
        category_id=data.category_id,
        bill_id=bill_id,
        description=data.description,
        amount=data.amount,
        transaction_date=data.transaction_date,
        type=data.type,
        is_transfer=False,
    )
    session.add(tx)
    await session.flush()
    return [tx]
