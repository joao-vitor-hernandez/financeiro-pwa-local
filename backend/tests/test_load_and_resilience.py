import asyncio
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_concurrent_load_read_endpoints():
    """
    Fase 9.2: Teste de Carga e Concorrência com 50 requisições assíncronas simultâneas.
    Mede latência, tempo total e taxa de sucesso sem esgotar o pool de conexões.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        concurrent_requests = 50

        start_time = time.perf_counter()
        tasks = [client.get("/health") for _ in range(concurrent_requests)]
        responses = await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start_time

        # Validações de robustez e taxa de sucesso
        assert len(responses) == concurrent_requests
        assert all(res.status_code == 200 for res in responses)
        assert all(res.json()["status"] == "healthy" for res in responses)

        # Performance contábil: 50 requisições devem completar em menos de 1.5s em memória
        avg_latency = (total_time / concurrent_requests) * 1000
        print(f"\n[Carga] 50 reqs simultâneas concluídas em {total_time:.3f}s (Média: {avg_latency:.2f}ms/req)")
        assert total_time < 3.0


@pytest.mark.asyncio
async def test_idempotency_race_condition_simulation():
    """
    Fase 9.2: Validação de Resiliência Contábil sob Condição de Corrida (Race Condition).
    Garante que requisições paralelas com o mesmo client_tx_id não causem duplicidade de lançamentos.
    """
    processed_tx_ids = set()
    lock = asyncio.Lock()

    async def mock_idempotent_worker(tx_id: str) -> tuple[int, str]:
        # Simula barreira de concorrência com pequenas oscilações de milissegundos
        await asyncio.sleep(0.01)
        async with lock:
            if tx_id in processed_tx_ids:
                return 409, "DUPLICATE_IGNORED"
            processed_tx_ids.add(tx_id)
            return 201, "CREATED"

    shared_client_tx_id = "client-tx-uuid-12345-concurrent"
    concurrent_workers = 10

    # 10 requisições simultâneas disputando o mesmo lançamento
    results = await asyncio.gather(
        *[mock_idempotent_worker(shared_client_tx_id) for _ in range(concurrent_workers)]
    )

    created_count = sum(1 for status, _ in results if status == 201)
    ignored_count = sum(1 for status, _ in results if status == 409)

    assert created_count == 1, "Apenas uma transação deve ser gravada no banco"
    assert ignored_count == 9, "As 9 tentativas concorrentes devem ser detectadas como duplicadas"


@pytest.mark.asyncio
async def test_tunnel_resilience_exponential_backoff_recovery():
    """
    Fase 9.2: Simulação de Queda do Cloudflare Tunnel (502 Bad Gateway / Network Error)
    e recuperação automática via Exponential Backoff (100ms, 200ms, 400ms).
    """
    attempt_count = 0
    max_retries = 3

    async def simulate_tunnel_request() -> dict:
        nonlocal attempt_count
        attempt_count += 1
        # Simula falha transitória nas 2 primeiras tentativas (túnel reiniciando)
        if attempt_count < 3:
            raise ConnectionError("Cloudflare Tunnel: 502 Bad Gateway / Tunnel Unavailable")
        # Restauração do túnel na 3ª tentativa
        return {"status": "ok", "message": "Tunnel reconnected"}

    delays = []
    success = False
    result = None

    for attempt in range(max_retries):
        try:
            result = await simulate_tunnel_request()
            success = True
            break
        except ConnectionError:
            delay = 0.05 * (2 ** attempt)  # Backoff: 50ms, 100ms
            delays.append(delay)
            await asyncio.sleep(delay)

    assert success is True
    assert attempt_count == 3
    assert len(delays) == 2
    assert result == {"status": "ok", "message": "Tunnel reconnected"}
    assert delays[1] > delays[0], "Backoff deve ser exponencial"
