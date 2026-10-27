import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_status_initial_and_setup(unauth_client: AsyncClient):
    # 1. Verifica status inicial antes da criação do PIN
    res = await unauth_client.get("/api/v1/auth/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_setup"] is False
    assert data["email"] == "jvhernandez.dev@gmail.com"

    # 2. Configura PIN inicial (6 dígitos)
    setup_res = await unauth_client.post(
        "/api/v1/auth/setup",
        json={"pin": "654321"},
    )
    assert setup_res.status_code == 201
    setup_data = setup_res.json()
    assert "access_token" in setup_data
    assert setup_data["token_type"] == "bearer"

    # 3. Status agora deve refletir que o PIN está configurado
    res2 = await unauth_client.get("/api/v1/auth/status")
    assert res2.status_code == 200
    assert res2.json()["is_setup"] is True

    # 4. Tentar configurar novamente deve ser rejeitado com 400
    dup_res = await unauth_client.post(
        "/api/v1/auth/setup",
        json={"pin": "111111"},
    )
    assert dup_res.status_code == 400


@pytest.mark.asyncio
async def test_pin_login_success_and_brute_force_lockout(unauth_client: AsyncClient):
    # 1. Configura PIN 987654
    await unauth_client.post("/api/v1/auth/setup", json={"pin": "987654"})

    # 2. Login com PIN correto
    login_res = await unauth_client.post("/api/v1/auth/login", json={"pin": "987654"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token

    # 3. Testa endpoint protegido /auth/me usando o token gerado
    me_res = await unauth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "jvhernandez.dev@gmail.com"

    # 4. Teste de PIN incorreto (deve falhar e informar tentativas restantes)
    wrong1 = await unauth_client.post("/api/v1/auth/login", json={"pin": "000000"})
    assert wrong1.status_code == 401
    assert "tentativa(s)" in wrong1.json()["detail"]

    # 5. Mais 3 tentativas incorretas (total 4)
    for _ in range(3):
        res = await unauth_client.post("/api/v1/auth/login", json={"pin": "000000"})
        assert res.status_code == 401

    # 6. A 5ª tentativa incorreta deve bloquear a conta (HTTP 429 Too Many Requests)
    locked_res = await unauth_client.post("/api/v1/auth/login", json={"pin": "000000"})
    assert locked_res.status_code == 429
    assert "Bloqueado por 15 minutos" in locked_res.json()["detail"]

    # 7. Mesmo se tentar com o PIN correto agora, o acesso é bloqueado temporariamente
    blocked_res = await unauth_client.post("/api/v1/auth/login", json={"pin": "987654"})
    assert blocked_res.status_code == 429
    assert "bloqueado temporariamente" in blocked_res.json()["detail"]


@pytest.mark.asyncio
async def test_protected_routes_require_bearer_token(unauth_client: AsyncClient):
    # 1. Tentar acessar contas sem token -> 401
    unauth_res = await unauth_client.get("/api/v1/accounts")
    assert unauth_res.status_code == 401
    assert "Autenticação obrigatória" in unauth_res.json()["detail"]

    # 2. Tentar acessar com token forjado/inválido -> 401
    invalid_res = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": "Bearer token_falso_invalido_123"},
    )
    assert invalid_res.status_code == 401

    # 3. Cria usuário e obtém token válido
    setup_res = await unauth_client.post("/api/v1/auth/setup", json={"pin": "123456"})
    token = setup_res.json()["access_token"]

    # 4. Acessar contas com token válido -> 200 OK
    auth_res = await unauth_client.get(
        "/api/v1/accounts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert auth_res.status_code == 200
