import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from app.services.inter_client import InterClient
from app.services.mercadopago_client import MercadoPagoClient
from app.services.ofx_service import OFXImportService

SAMPLE_OFX_CONTENT = """OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:UTF-8
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20261106120000[-03:EST]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>260
<ACCTID>1234567-8
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261101120000[-03:EST]
<DTEND>20261106120000[-03:EST]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105120000[-03:EST]
<TRNAMT>-45.90
<FITID>FITID-DEBIT-001
<MEMO>Farmácia São João & Supermercado Pão de Açúcar
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261106100000[-03:EST]
<TRNAMT>1500.00
<FITID>FITID-CREDIT-002
<MEMO>Transferência Pix Recebida - João Hernandez
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1454.10
<DTASOF>20261106120000[-03:EST]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>"""

SAMPLE_CC_OFX = """<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CURDEF>BRL
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261104120000[-03:EST]
<TRNAMT>-89.90
<FITID>FITID-CC-001
<MEMO>Restaurante Bom Sabor Café & Grill
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>"""

SAMPLE_CSV = """Data;Descrição;Valor;Documento
05/11/2026;Posto Ipiranga Combustível;-100,50;DOC-9988
06/11/2026;Salário Empresa X;5000,00;DOC-9989
"""


def test_parse_ofx_debit_credit_and_special_chars():
    """Valida o parsing puro de OFX com débitos, créditos e acentuação pt-BR."""
    items = OFXImportService.parse_ofx(SAMPLE_OFX_CONTENT.encode("utf-8"))
    assert len(items) == 2

    debit_item = items[0]
    assert debit_item.fitid == "FITID-DEBIT-001"
    assert debit_item.type == TransactionType.EXPENSE
    assert debit_item.amount == Decimal("45.90")
    assert "Farmácia São João" in debit_item.description
    assert "Pão de Açúcar" in debit_item.description

    credit_item = items[1]
    assert credit_item.fitid == "FITID-CREDIT-002"
    assert credit_item.type == TransactionType.INCOME
    assert credit_item.amount == Decimal("1500.00")
    assert "Transferência Pix" in credit_item.description


def test_parse_ofx_credit_card():
    """Valida parsing de extrato de cartão de crédito OFX (<CREDITCARDMSGSRSV1>)."""
    items = OFXImportService.parse_ofx(SAMPLE_CC_OFX.encode("utf-8"))
    assert len(items) == 1
    assert items[0].fitid == "FITID-CC-001"
    assert items[0].amount == Decimal("89.90")
    assert items[0].type == TransactionType.EXPENSE
    assert "Café & Grill" in items[0].description


def test_parse_csv_statement():
    """Valida parsing de extratos bancários em formato CSV brasileiro."""
    items = OFXImportService.parse_csv(SAMPLE_CSV.encode("utf-8"))
    assert len(items) == 2
    assert items[0].fitid == "DOC-9988"
    assert items[0].amount == Decimal("100.50")
    assert items[0].type == TransactionType.EXPENSE

    assert items[1].fitid == "DOC-9989"
    assert items[1].amount == Decimal("5000.00")
    assert items[1].type == TransactionType.INCOME


@pytest.mark.asyncio
async def test_preview_and_atomic_deduplication(db_session: AsyncSession):
    """
    Testa preview e importação com deduplicação atômica:
    1. Primeira importação insere 2 transações e atualiza o saldo (+1454.10).
    2. Segunda importação com o mesmo arquivo identifica 2 duplicatas e insere 0 transações.
    3. O saldo da conta permanece estritamente inalterado após a reimportação.
    """
    account = Account(
        id=uuid.uuid4(),
        name="Conta Inter Teste",
        type=AccountType.CHECKING,
        balance=Decimal("1000.00"),
        currency="BRL",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    content_bytes = SAMPLE_OFX_CONTENT.encode("utf-8")

    # 1. Preview inicial: 2 novas, 0 duplicadas
    preview_res = await OFXImportService.preview_import(
        session=db_session,
        account_id=account.id,
        content_bytes=content_bytes,
        filename="extrato.ofx",
    )
    assert preview_res.total_found == 2
    assert preview_res.new_count == 2
    assert preview_res.duplicated_count == 0
    assert not any(t.is_duplicate for t in preview_res.transactions)

    # 2. Executar primeira importação
    import_res_1 = await OFXImportService.execute_import(
        session=db_session,
        account_id=account.id,
        content_bytes=content_bytes,
        filename="extrato.ofx",
    )
    assert import_res_1.imported_count == 2
    assert import_res_1.duplicated_count == 0

    # Verificar saldo após importação: 1000 - 45.90 + 1500 = 2454.10
    await db_session.refresh(account)
    assert account.balance == Decimal("2454.10")

    # 3. Preview após primeira importação: 0 novas, 2 duplicadas
    preview_res_2 = await OFXImportService.preview_import(
        session=db_session,
        account_id=account.id,
        content_bytes=content_bytes,
        filename="extrato.ofx",
    )
    assert preview_res_2.total_found == 2
    assert preview_res_2.new_count == 0
    assert preview_res_2.duplicated_count == 2
    assert all(t.is_duplicate for t in preview_res_2.transactions)

    # 4. Executar SEGUNDA importação com mesmo arquivo (deve ser idempotente / silenciosa)
    import_res_2 = await OFXImportService.execute_import(
        session=db_session,
        account_id=account.id,
        content_bytes=content_bytes,
        filename="extrato.ofx",
    )
    assert import_res_2.imported_count == 0
    assert import_res_2.duplicated_count == 2

    # Verificar saldo final: NÃO PODE ter sido alterado
    await db_session.refresh(account)
    assert account.balance == Decimal("2454.10")

    # Verificar quantidade de registros no banco: exatamente 2
    txs_stmt = select(Transaction).where(Transaction.account_id == account.id)
    txs = (await db_session.execute(txs_stmt)).scalars().all()
    assert len(txs) == 2


@pytest.mark.asyncio
async def test_api_import_ofx_endpoints_and_rfc7807(client: AsyncClient, db_session: AsyncSession):
    """Testa os endpoints HTTP de importação de OFX e tratamento RFC 7807 para erros."""
    account = Account(
        id=uuid.uuid4(),
        name="Nubank OFX API",
        type=AccountType.CHECKING,
        balance=Decimal("500.00"),
        currency="BRL",
    )
    db_session.add(account)
    await db_session.commit()

    # 1. Preview via HTTP
    files = {"file": ("extrato.ofx", SAMPLE_OFX_CONTENT.encode("utf-8"), "application/x-ofx")}
    data = {"account_id": str(account.id)}
    res_preview = await client.post("/api/v1/transactions/import-ofx/preview", files=files, data=data)
    assert res_preview.status_code == 200
    preview_json = res_preview.json()
    assert preview_json["new_count"] == 2
    assert preview_json["duplicated_count"] == 0

    # 2. Import via HTTP
    files = {"file": ("extrato.ofx", SAMPLE_OFX_CONTENT.encode("utf-8"), "application/x-ofx")}
    res_import = await client.post("/api/v1/transactions/import-ofx", files=files, data=data)
    assert res_import.status_code == 200
    import_json = res_import.json()
    assert import_json["imported_count"] == 2
    assert import_json["duplicated_count"] == 0

    # 3. Teste RFC 7807: Conta inexistente (404 Not Found)
    fake_account_id = str(uuid.uuid4())
    files = {"file": ("extrato.ofx", SAMPLE_OFX_CONTENT.encode("utf-8"), "application/x-ofx")}
    res_not_found = await client.post(
        "/api/v1/transactions/import-ofx",
        files=files,
        data={"account_id": fake_account_id},
    )
    assert res_not_found.status_code == 404
    assert res_not_found.headers["content-type"] == "application/problem+json"
    problem = res_not_found.json()
    assert problem["status"] == 404
    assert problem["title"] == "Recurso Não Encontrado"
    assert "não encontrada" in problem["detail"]

    # 4. Teste RFC 7807: Arquivo corrompido / não OFX (400 Bad Request)
    bad_files = {"file": ("corrupt.ofx", b"ESTE CONTEUDO NAO E UM OFX", "text/plain")}
    res_bad = await client.post(
        "/api/v1/transactions/import-ofx",
        files=bad_files,
        data={"account_id": str(account.id)},
    )
    assert res_bad.status_code == 400
    assert res_bad.headers["content-type"] == "application/problem+json"
    bad_problem = res_bad.json()
    assert bad_problem["status"] == 400
    assert bad_problem["title"] == "Requisição Inválida"


def test_mercadopago_client_unconfigured():
    """Valida que o cliente do Mercado Pago sinaliza configuração ausente sem quebrar."""
    client = MercadoPagoClient()
    # Se token não estiver no .env, is_configured retorna False
    if not client.access_token:
        assert client.is_configured() is False
        with pytest.raises(Exception):
            client._get_headers()


def test_inter_client_unconfigured():
    """Valida que o cliente do Banco Inter detecta ausência de certificados mTLS com segurança."""
    client = InterClient()
    # Se certificados não existem, is_configured retorna False
    if not client.cert_path:
        assert client.is_configured() is False
        with pytest.raises(Exception):
            client._get_cert_tuple()
