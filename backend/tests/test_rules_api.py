import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_rule_crud_operations(client: AsyncClient):
    """
    Testa criação, listagem com metadados de categoria, edição e remoção de regra de categorização.
    """
    # 1. Cria categoria
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Transporte", "type": "EXPENSE", "icon": "truck", "color": "#1DCDFE"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 2. Cria regra
    rule_res = await client.post(
        "/api/v1/rules",
        json={
            "name": "Uber e 99",
            "pattern": r"uber|99app|99pop",
            "clean_description": "Uber / 99 Viagem",
            "category_id": cat_id,
            "priority": 50,
            "is_active": True,
        },
    )
    assert rule_res.status_code == 201
    rule_data = rule_res.json()
    rule_id = rule_data["id"]
    assert rule_data["name"] == "Uber e 99"
    assert rule_data["category_name"] == "Transporte"
    assert rule_data["category_color"] == "#1DCDFE"

    # 3. Listagem
    list_res = await client.get("/api/v1/rules")
    assert list_res.status_code == 200
    rules = list_res.json()
    assert any(r["id"] == rule_id for r in rules)

    # 4. Atualização
    patch_res = await client.patch(
        f"/api/v1/rules/{rule_id}",
        json={"clean_description": "Uber Viagens", "priority": 25},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["clean_description"] == "Uber Viagens"
    assert patch_res.json()["priority"] == 25

    # 5. Deleção
    del_res = await client.delete(f"/api/v1/rules/{rule_id}")
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_rule_simulation_sandbox(client: AsyncClient):
    """
    Testa simulador com padrão candidato na hora da edição/criação (sem persistir).
    """
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Alimentação", "type": "EXPENSE", "icon": "coffee", "color": "#21D0B2"},
    )
    cat_id = cat_res.json()["id"]

    # Simulação que dá match
    sim_match = await client.post(
        "/api/v1/rules/simulate",
        json={
            "raw_text": "PAG*iFood*Refeicao Centro 23/10",
            "candidate_pattern": r"ifood",
            "candidate_clean_description": "iFood Refeição",
            "candidate_category_id": cat_id,
        },
    )
    assert sim_match.status_code == 200
    res_data = sim_match.json()
    assert res_data["is_match"] is True
    assert res_data["sanitized_text"] == "iFood*Refeicao Centro 23/10"
    assert res_data["final_description"] == "iFood Refeição"
    assert res_data["category_name"] == "Alimentação"

    # Simulação que não dá match
    sim_no_match = await client.post(
        "/api/v1/rules/simulate",
        json={
            "raw_text": "COMPRA CARTAO - Drogaria Sao Paulo",
            "candidate_pattern": r"ifood",
            "candidate_clean_description": "iFood Refeição",
            "candidate_category_id": cat_id,
        },
    )
    assert sim_no_match.status_code == 200
    assert sim_no_match.json()["is_match"] is False
    assert sim_no_match.json()["sanitized_text"] == "Drogaria Sao Paulo"
    assert sim_no_match.json()["final_description"] == "Drogaria Sao Paulo"


@pytest.mark.asyncio
async def test_rule_simulation_against_saved_rules_and_reorder(client: AsyncClient):
    """
    Testa simulação contra regras salvas respeitando prioridades e reordenação em lote.
    """
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Streaming", "type": "EXPENSE", "icon": "film", "color": "#a855f7"},
    )
    cat_id = cat_res.json()["id"]

    rule1 = await client.post(
        "/api/v1/rules",
        json={
            "name": "Netflix Específica",
            "pattern": r"netflix",
            "clean_description": "Netflix Streaming Mensal",
            "category_id": cat_id,
            "priority": 10,
        },
    )
    r1_id = rule1.json()["id"]

    rule2 = await client.post(
        "/api/v1/rules",
        json={
            "name": "Streaming Genérico",
            "pattern": r"netflix|spotify|prime",
            "clean_description": "Serviço de Streaming",
            "category_id": cat_id,
            "priority": 20,
        },
    )
    r2_id = rule2.json()["id"]

    # Simula contra todas as regras salvas
    sim_res = await client.post(
        "/api/v1/rules/simulate",
        json={"raw_text": "PAG*NETFLIX.COM SP"},
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["is_match"] is True
    # r1 tem prioridade 10 (menor = maior prioridade), deve vencer
    assert sim_data["matched_rule_id"] == r1_id
    assert sim_data["final_description"] == "Netflix Streaming Mensal"

    # Reordena invertendo as prioridades: agora r2 vem antes de r1
    reorder_res = await client.post(
        "/api/v1/rules/reorder",
        json={"rule_ids": [r2_id, r1_id]},
    )
    assert reorder_res.status_code == 200

    # Simula novamente: agora r2 deve vencer
    sim_res2 = await client.post(
        "/api/v1/rules/simulate",
        json={"raw_text": "PAG*NETFLIX.COM SP"},
    )
    assert sim_res2.status_code == 200
    assert sim_res2.json()["matched_rule_id"] == r2_id
    assert sim_res2.json()["final_description"] == "Serviço de Streaming"

