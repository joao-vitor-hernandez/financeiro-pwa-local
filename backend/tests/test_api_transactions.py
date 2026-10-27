from datetime import UTC, datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_financial_flow(client: AsyncClient):
    # 1. Criar Conta Corrente com saldo inicial de R$ 1.000,00
    acc_res = await client.post(
        "/api/v1/accounts",
        json={
            "name": "Nubank Conta",
            "type": "CHECKING",
            "initial_balance": "1000.00",
            "currency": "BRL",
        },
    )
    assert acc_res.status_code == 201
    checking_acc = acc_res.json()
    checking_id = checking_acc["id"]
    assert Decimal(checking_acc["balance"]) == Decimal("1000.00")

    # 2. Criar Conta de Investimentos com saldo inicial de R$ 5.000,00
    inv_res = await client.post(
        "/api/v1/accounts",
        json={
            "name": "Tesouro Direto",
            "type": "INVESTMENT",
            "initial_balance": "5000.00",
            "currency": "BRL",
        },
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]

    # 3. Criar Cartão de Crédito (fecha dia 20, vence dia 28)
    card_res = await client.post(
        "/api/v1/accounts",
        json={
            "name": "Cartão XP Visa Infinite",
            "type": "CREDIT_CARD",
            "initial_balance": "0.00",
            "closing_day": 20,
            "due_day": 28,
            "credit_limit": "15000.00",
        },
    )
    assert card_res.status_code == 201
    card_id = card_res.json()["id"]

    # 4. Criar Categoria de Despesa (Alimentação)
    cat_res = await client.post(
        "/api/v1/categories",
        json={
            "name": "Alimentação",
            "type": "EXPENSE",
            "icon": "utensils",
            "color": "#ef4444",
        },
    )
    assert cat_res.status_code == 201
    category_id = cat_res.json()["id"]

    # 5. Lançar Despesa à Vista na Conta Corrente: R$ 150,50
    now_iso = datetime.now(UTC).isoformat()
    tx_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": checking_id,
            "category_id": category_id,
            "description": "Supermercado Semanal",
            "amount": "150.50",
            "transaction_date": now_iso,
            "type": "EXPENSE",
            "installments": 1,
            "is_transfer": False,
        },
    )
    assert tx_res.status_code == 201

    # Validar se o saldo da Conta Corrente reduziu exatamente: 1000 - 150.50 = 849.50
    acc_check = await client.get(f"/api/v1/accounts/{checking_id}")
    assert Decimal(acc_check.json()["balance"]) == Decimal("849.50")

    # 6. Lançar Compra Parcelada no Cartão de Crédito: R$ 100,00 em 3x
    card_tx_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": card_id,
            "category_id": category_id,
            "description": "Teclado Mecânico",
            "amount": "100.00",
            "transaction_date": now_iso,
            "type": "EXPENSE",
            "installments": 3,
            "is_transfer": False,
        },
    )
    assert card_tx_res.status_code == 201
    installments_data = card_tx_res.json()
    assert len(installments_data) == 3
    # Centavos exatos: Parcela 1 = 33.34, Parcela 2 = 33.33, Parcela 3 = 33.33
    assert Decimal(installments_data[0]["amount"]) == Decimal("33.34")
    assert Decimal(installments_data[1]["amount"]) == Decimal("33.33")
    assert Decimal(installments_data[2]["amount"]) == Decimal("33.33")
    total_installments_sum = sum(Decimal(p["amount"]) for p in installments_data)
    assert total_installments_sum == Decimal("100.00")

    # 7. Transferência Neutra entre Contas Próprias (Conta Corrente -> Investimento): R$ 300,00
    transfer_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": checking_id,
            "transfer_target_account_id": inv_id,
            "description": "Aporte Mensal",
            "amount": "300.00",
            "transaction_date": now_iso,
            "type": "EXPENSE",
            "installments": 1,
            "is_transfer": True,
        },
    )
    assert transfer_res.status_code == 201
    transfer_data = transfer_res.json()
    assert len(transfer_data) == 2  # Gerou o par débito e crédito
    assert transfer_data[0]["transfer_pair_id"] == transfer_data[1]["transfer_pair_id"]
    assert transfer_data[0]["is_transfer"] is True
    assert transfer_data[1]["is_transfer"] is True

    # Verificar novos saldos após a transferência:
    # Checking: 849.50 - 300.00 = 549.50
    # Investment: 5000.00 + 300.00 = 5300.00
    updated_checking = (await client.get(f"/api/v1/accounts/{checking_id}")).json()
    updated_inv = (await client.get(f"/api/v1/accounts/{inv_id}")).json()
    assert Decimal(updated_checking["balance"]) == Decimal("549.50")
    assert Decimal(updated_inv["balance"]) == Decimal("5300.00")

    # 8. Consultar o Dashboard Summary
    dash_res = await client.get("/api/v1/dashboard/summary")
    assert dash_res.status_code == 200
    summary = dash_res.json()

    assert Decimal(summary["total_checking_balance"]) == Decimal("549.50")
    assert Decimal(summary["total_investments"]) == Decimal("5300.00")
    # Passivo total somando todas as faturas abertas futuras do cartão
    assert Decimal(summary["total_credit_card_debt"]) == Decimal("100.00")
    # Fatura aberta do ciclo atual
    assert Decimal(summary["current_card_bill"]) == Decimal("33.34")
    # As despesas do mês DEVEM ser apenas o supermercado (150.50) + parcela 1 (33.34) = 183.84
    # A transferência de R$ 300,00 NÃO pode inflar as despesas do mês!
    assert Decimal(summary["monthly_expenses"]) == Decimal("183.84")

    # 9. Liquidação/Pagamento da Fatura Aberta
    bills_res = await client.get(f"/api/v1/bills/account/{card_id}")
    assert bills_res.status_code == 200
    bills = bills_res.json()
    assert len(bills) == 3  # Três faturas (meses 11, 12 e 1)

    # A fatura do mês 11 é a primeira a vencer
    first_bill = next(b for b in bills if b["month"] == 11)
    first_bill_id = first_bill["id"]
    assert Decimal(first_bill["total_amount"]) == Decimal("33.34")

    pay_res = await client.post(
        f"/api/v1/bills/{first_bill_id}/pay?payment_account_id={checking_id}"
    )
    assert pay_res.status_code == 200
    paid_bill = pay_res.json()
    assert paid_bill["status"] == "PAID"

    # Saldo da conta corrente deve ter sido debitado: 549.50 - 33.34 = 516.16
    checking_after_pay = (await client.get(f"/api/v1/accounts/{checking_id}")).json()
    assert Decimal(checking_after_pay["balance"]) == Decimal("516.16")

    # Tentar pagar novamente deve falhar (idempotência e proteção contra duplo pagamento)
    double_pay_res = await client.post(
        f"/api/v1/bills/{first_bill_id}/pay?payment_account_id={checking_id}"
    )
    assert double_pay_res.status_code == 400
