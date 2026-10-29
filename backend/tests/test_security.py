from datetime import UTC, datetime, timedelta
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, settings
from app.core.security import create_access_token
from app.models.account import Account, AccountType
from app.models.transaction import Transaction
from app.models.user import User


@pytest.mark.asyncio
async def test_jwt_none_algorithm_attack_rejected(unauth_client: AsyncClient, auth_user: User):
    """
    CWE-327 / CWE-347: Proteção contra ataque de algoritmo 'none' no JWT.
    Garante que tokens forjados sem assinatura ou com 'alg: none' sejam rejeitados com HTTP 401.
    """
    # Constrói o token 'alg: none' manualmente (como um atacante faria ao tentar bypass)
    import base64
    import json

    header_b64 = (
        base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
        .decode()
        .rstrip("=")
    )
    payload_b64 = (
        base64.urlsafe_b64encode(
            json.dumps(
                {
                    "sub": auth_user.email,
                    "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
                }
            ).encode()
        )
        .decode()
        .rstrip("=")
    )
    forged_token = f"{header_b64}.{payload_b64}."

    response = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": f"Bearer {forged_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_jwt_tampered_signature_attack_rejected(unauth_client: AsyncClient, auth_user: User):
    """
    CWE-347: Proteção contra adulteração de assinatura JWT.
    Garante que tokens assinados com chaves falsas ou payloads adulterados sejam rejeitados com HTTP 401.
    """
    fake_token = jwt.encode(
        {"sub": auth_user.email, "exp": datetime.now(UTC) + timedelta(hours=1)},
        key="chave_falsa_do_atacante_com_32_bytes_de_tamanho_minimo",
        algorithm="HS256",
    )

    response = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": f"Bearer {fake_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_jwt_expired_token_rejected(unauth_client: AsyncClient, auth_user: User):
    """
    CWE-613: Revogação e expiração estrita de sessão.
    Garante que tokens com 'exp' expirado sejam sumariamente rejeitados com HTTP 401.
    """
    expired_token = create_access_token(
        data={"sub": auth_user.email},
        expires_delta=timedelta(minutes=-15),
    )

    response = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_jwt_missing_sub_claim_rejected(unauth_client: AsyncClient):
    """
    CWE-287: Proteção contra tokens forjados com claims vazios/ausentes.
    Tokens sem a claim 'sub' (subject) devem ser rejeitados com HTTP 401.
    """
    token_without_sub = create_access_token(
        data={"role": "admin", "custom": "value"},
    )

    response = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": f"Bearer {token_without_sub}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_deactivated_user_blocked_immediately(
    unauth_client: AsyncClient, auth_user: User, db_session: AsyncSession
):
    """
    CWE-284: Bloqueio imediato de contas desativadas.
    Mesmo com um JWT criptograficamente válido e não expirado, se o usuário for
    desativado no banco de dados (is_active=False), o acesso é bloqueado com HTTP 401.
    """
    valid_token = create_access_token(data={"sub": auth_user.email})

    # Desativa o usuário no banco
    auth_user.is_active = False
    await db_session.commit()

    response = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 401
    assert "desativado" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_security_headers_present_on_all_responses(unauth_client: AsyncClient):
    """
    OWASP Secure Headers: Validação de presença obrigatória de cabeçalhos de defesa.
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY (anti-clickjacking)
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy
    """
    response = await unauth_client.get("/health")
    assert response.status_code == 200

    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in headers.get("permissions-policy", "")
    assert "microphone=()" in headers.get("permissions-policy", "")


@pytest.mark.asyncio
async def test_cors_rejects_unauthorized_external_origin(unauth_client: AsyncClient):
    """
    CWE-942: Proteção contra CORS excessivamente permissivo.
    Garante que domínios externos arbitrários não recebam Access-Control-Allow-Origin.
    """
    response = await unauth_client.options(
        "/api/v1/accounts",
        headers={
            "Origin": "https://malicious-attacker.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # A resposta para origem não autorizada não deve refletir o origin invasor
    allowed_origin = response.headers.get("access-control-allow-origin")
    assert allowed_origin != "https://malicious-attacker.com"


@pytest.mark.asyncio
async def test_pin_input_sanitization_and_validation(unauth_client: AsyncClient):
    """
    CWE-20: Validação de entrada estrita para PIN de autenticação.
    Rejeita caracteres não numéricos, injeções SQL, espaços e comprimentos anômalos com HTTP 422.
    """
    malicious_pins = [
        "abcdef",
        "' OR 1=1 --",
        "12345",
        "1234567",
        "12 456",
        "<script>",
        "12345\x00",
    ]

    for bad_pin in malicious_pins:
        res = await unauth_client.post(
            "/api/v1/auth/login",
            json={"pin": bad_pin},
        )
        assert res.status_code == 422, f"PIN '{bad_pin}' deveria ter sido rejeitado com 422"


@pytest.mark.asyncio
async def test_sql_injection_defense_in_accounts(client: AsyncClient, db_session: AsyncSession):
    """
    CWE-89: Proteção contra SQL Injection via ORM parametrizado (SQLAlchemy 2.0).
    Garante que strings maliciosas sejam tratadas estritamente como texto literal,
    sem quebrar a sintaxe ou dropar tabelas do banco relacional.
    """
    sqli_payload = "Conta Teste'; DROP TABLE accounts; --"
    res = await client.post(
        "/api/v1/accounts",
        json={
            "name": sqli_payload,
            "type": "CHECKING",
            "currency": "BRL",
            "initial_balance": "100.00",
        },
    )
    assert res.status_code == 201
    created_acc = res.json()
    assert created_acc["name"] == sqli_payload

    # Confirma que a tabela continua intacta e o registro foi gravado como texto literal
    stmt = select(Account).where(Account.name == sqli_payload)
    result = await db_session.execute(stmt)
    acc = result.scalar_one_or_none()
    assert acc is not None
    assert acc.name == sqli_payload


@pytest.mark.asyncio
async def test_sql_injection_defense_in_transactions(
    client: AsyncClient, db_session: AsyncSession
):
    """
    CWE-89: Proteção contra SQL Injection na descrição de lançamentos.
    """
    acc_res = await client.post(
        "/api/v1/accounts",
        json={"name": "Conta Principal", "type": "CHECKING", "initial_balance": "500.00"},
    )
    acc_id = acc_res.json()["id"]

    sqli_desc = "Mercado'; UPDATE accounts SET balance = 999999; --"
    tx_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "description": sqli_desc,
            "amount": "50.00",
            "transaction_date": datetime.now(UTC).isoformat(),
            "type": "EXPENSE",
            "installments": 1,
        },
    )
    assert tx_res.status_code == 201

    # Confirma que o saldo da conta NÃO foi alterado para 999999
    stmt = select(Account).where(Account.id == uuid.UUID(acc_id))
    result = await db_session.execute(stmt)
    acc = result.scalar_one_or_none()
    assert acc.balance == Decimal("450.00")


@pytest.mark.asyncio
async def test_financial_decimal_tampering_boundaries(client: AsyncClient):
    """
    CWE-20 / CWE-190: Blindagem contábil contra valores negativos, nulos ou com precisão arbitrária falsa.
    Garante que valores contábeis inválidos sejam rejeitados antes de alcançar as regras de negócio.
    """
    acc_res = await client.post(
        "/api/v1/accounts",
        json={"name": "Conta Saldo", "type": "CHECKING", "initial_balance": "100.00"},
    )
    acc_id = acc_res.json()["id"]

    # 1. Valor negativo
    neg_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "description": "Tentativa Negativa",
            "amount": "-50.00",
            "transaction_date": datetime.now(UTC).isoformat(),
            "type": "EXPENSE",
        },
    )
    assert neg_res.status_code == 422

    # 2. Valor zero
    zero_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "description": "Tentativa Zero",
            "amount": "0.00",
            "transaction_date": datetime.now(UTC).isoformat(),
            "type": "EXPENSE",
        },
    )
    assert zero_res.status_code == 422

    # 3. Mais de 2 casas decimais (violação da menor unidade monetária: centavo)
    prec_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "description": "Precisão Fracionária Ilegal",
            "amount": "10.999",
            "transaction_date": datetime.now(UTC).isoformat(),
            "type": "EXPENSE",
        },
    )
    assert prec_res.status_code == 422

    # 4. Número ilegal de parcelas (0 ou 9999)
    inst_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acc_id,
            "description": "Parcela Zero",
            "amount": "100.00",
            "transaction_date": datetime.now(UTC).isoformat(),
            "type": "EXPENSE",
            "installments": 0,
        },
    )
    assert inst_res.status_code == 422


@pytest.mark.asyncio
async def test_categorization_rule_invalid_regex_rejection(client: AsyncClient):
    """
    CWE-1333: Prevenção contra Regex malformadas ou sintaxe inválida no motor determinístico.
    Garante que padrões inválidos (ex: parênteses não fechados) sejam bloqueados no schema (HTTP 422).
    """
    dummy_cat_id = str(uuid.uuid4())
    bad_regex_payload = {
        "name": "Regra Malformada",
        "pattern": "[a-z(unclosed_regex",
        "category_id": dummy_cat_id,
        "priority": 100,
    }

    res = await client.post("/api/v1/rules", json=bad_regex_payload)
    assert res.status_code == 422
    assert "Sintaxe de expressão regular inválida" in str(res.json())


def test_production_hardening_rejects_weak_or_dev_jwt_secret():
    """
    CWE-798: Proteção contra subida em produção com chave JWT de desenvolvimento.
    Garante que a inicialização falhe (fail-closed) se ENVIRONMENT='production' e a chave for insegura.
    """
    # 1. Falha com a chave padrão de desenvolvimento
    with pytest.raises(ValueError, match="VIOLAÇÃO CRÍTICA DE SEGURANÇA"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="dev_secret_key_financial_pwa_local_only_1234567890abcdef",
        )

    # 2. Falha com chave curta (< 32 caracteres)
    with pytest.raises(ValueError, match="VIOLAÇÃO CRÍTICA DE SEGURANÇA"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="chave_curta_demais",
        )

    # 3. Sucesso com chave forte e entropy adequada
    prod_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="uma_chave_criptografica_forte_e_longa_para_producao_2026_segura",
    )
    assert prod_settings.ENVIRONMENT == "production"

