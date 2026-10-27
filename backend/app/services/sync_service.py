import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction, TransactionType
from app.services.accounting import get_or_create_bill
from app.services.pluggy_client import pluggy_client
from app.services.rule_engine import match_categorization_rule

logger = logging.getLogger(__name__)


async def sync_single_account(
    session: AsyncSession, account: Account, from_date: str | None = None
) -> dict[str, Any]:
    """
    Sincroniza os lançamentos de uma conta com a Pluggy aplicando:
    1. Idempotência estrita (evita duplicatas e suporta transições de pendente -> confirmado).
    2. Motor de regras determinístico para auto-categorização e sanitização.
    3. Alocação em fatura de cartão ou atualização de saldo de conta corrente.
    """
    if not account.pluggy_account_id:
        return {
            "account_id": str(account.id),
            "status": "skipped",
            "reason": "Sem vínculo com Pluggy",
        }

    # Carregar regras de categorização ativas ordenadas por prioridade
    rules_stmt = (
        select(CategorizationRule)
        .where(CategorizationRule.is_active == True)
        .order_by(CategorizationRule.priority.asc())
    )
    rules_res = await session.execute(rules_stmt)
    rules: list[CategorizationRule] = list(rules_res.scalars().all())

    # Buscar lançamentos na API da Pluggy
    pluggy_data = await pluggy_client.fetch_transactions(
        account_id=account.pluggy_account_id, from_date=from_date
    )
    raw_txs = pluggy_data.get("results", [])

    inserted_count = 0
    updated_count = 0

    for item in raw_txs:
        external_id = str(item.get("id"))
        raw_description = item.get("description", "")
        raw_amount = Decimal(str(item.get("amount", "0.00")))
        tx_date_str = item.get("date")

        try:
            # Parse da data da transação
            tx_date = datetime.fromisoformat(tx_date_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            tx_date = datetime.now(UTC)

        # Montar valores absolutos e direção contábil
        if raw_amount < Decimal("0.00"):
            tx_type = TransactionType.EXPENSE
            amount = abs(raw_amount)
        else:
            tx_type = TransactionType.INCOME
            amount = raw_amount

        # Avaliar contra o motor de regras
        category_id, clean_desc = match_categorization_rule(raw_description, rules)

        # Verificar se a transação já foi importada anteriormente (Idempotência)
        existing_stmt = select(Transaction).where(
            Transaction.account_id == account.id, Transaction.external_id == external_id
        )
        existing_res = await session.execute(existing_stmt)
        existing_tx = existing_res.scalars().first()

        if existing_tx:
            # Transação existente: atualiza descrição original ou metadados se necessário
            existing_tx.metadata_json = item
            if existing_tx.original_description != raw_description:
                existing_tx.original_description = raw_description
            updated_count += 1
        else:
            # Nova transação: aplicar impacto contábil
            bill_id = None
            if account.type == AccountType.CREDIT_CARD:
                bill = await get_or_create_bill(
                    session=session, account=account, tx_date=tx_date, installment_offset_months=0
                )
                bill.total_amount += amount
                bill_id = bill.id
            else:
                if tx_type == TransactionType.INCOME:
                    account.balance += amount
                else:
                    account.balance -= amount

            new_tx = Transaction(
                account_id=account.id,
                category_id=category_id,
                bill_id=bill_id,
                description=clean_desc,
                original_description=raw_description,
                amount=amount,
                transaction_date=tx_date,
                type=tx_type,
                is_transfer=False,
                external_id=external_id,
                metadata_json=item,
            )
            session.add(new_tx)
            inserted_count += 1

    await session.flush()

    return {
        "account_id": str(account.id),
        "account_name": account.name,
        "status": "success",
        "total_processed": len(raw_txs),
        "inserted": inserted_count,
        "updated": updated_count,
    }


async def sync_all_accounts(
    session: AsyncSession, from_date: str | None = None
) -> list[dict[str, Any]]:
    """
    Sincroniza todas as contas cadastradas que possuem vínculo com o Open Finance.
    """
    stmt = select(Account).where(Account.is_active == True, Account.pluggy_account_id.is_not(None))
    result = await session.execute(stmt)
    accounts = result.scalars().all()

    summary = []
    for acc in accounts:
        acc_summary = await sync_single_account(session=session, account=acc, from_date=from_date)
        summary.append(acc_summary)

    return summary
