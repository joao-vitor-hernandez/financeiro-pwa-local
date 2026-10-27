import uuid

from app.models.categorization_rule import CategorizationRule
from app.services.rule_engine import match_categorization_rule, sanitize_description


def test_sanitize_description_bank_prefixes():
    """Testa a remoção de ruídos de adquirentes e processadoras bancárias"""
    assert sanitize_description("PAG*Restaurante Central") == "Restaurante Central"
    assert sanitize_description("PG*Lojas Americanas") == "Lojas Americanas"
    assert sanitize_description("COMPRA COM CARTAO - Posto Shell") == "Posto Shell"
    assert sanitize_description("COMPRA NO DEBITO - Farmacia Raia") == "Farmacia Raia"
    assert sanitize_description("PIX ENVIADO - Joao Silva") == "Joao Silva"
    assert sanitize_description("  MUITOS   ESPACOS   AQUI  ") == "MUITOS ESPACOS AQUI"
    assert sanitize_description("") == ""


def test_match_categorization_rule_priority_and_clean_name():
    """Testa correspondência de regra por prioridade e substituição por nome amigável"""
    cat_transporte_id = uuid.uuid4()
    cat_alimentacao_id = uuid.uuid4()

    rule_uber = CategorizationRule(
        name="Uber",
        pattern=r"(?i)uber|99app",
        clean_description="Uber",
        category_id=cat_transporte_id,
        priority=10,
        is_active=True,
    )

    rule_geral = CategorizationRule(
        name="Genérico",
        pattern=r".*",
        clean_description="Genérico",
        category_id=cat_alimentacao_id,
        priority=999,
        is_active=True,
    )

    # Deve casar com a regra de maior prioridade (Uber, prioridade 10)
    matched_cat, clean_desc = match_categorization_rule(
        "PAG*UBER *TRIP HELP.UBER.COM", [rule_geral, rule_uber]
    )
    assert matched_cat == cat_transporte_id
    assert clean_desc == "Uber"


def test_match_categorization_rule_inactive_ignored():
    """Testa se regras desativadas são ignoradas"""
    cat_id = uuid.uuid4()
    inactive_rule = CategorizationRule(
        name="Netflix",
        pattern=r"netflix",
        clean_description="Netflix Streaming",
        category_id=cat_id,
        priority=10,
        is_active=False,
    )

    matched_cat, clean_desc = match_categorization_rule("NETFLIX.COM SAO PAULO", [inactive_rule])
    assert matched_cat is None
    assert clean_desc == "NETFLIX.COM SAO PAULO"


def test_match_categorization_rule_invalid_regex_handled():
    """Testa se regex com sintaxe inválida não quebra a execução"""
    cat_id = uuid.uuid4()
    broken_rule = CategorizationRule(
        name="Quebrada",
        pattern=r"[a-z(",  # Parêntese aberto sem fechar (inválido)
        clean_description="Teste",
        category_id=cat_id,
        priority=10,
        is_active=True,
    )

    matched_cat, clean_desc = match_categorization_rule("Qualquer Estabelecimento", [broken_rule])
    assert matched_cat is None
    assert clean_desc == "Qualquer Estabelecimento"
