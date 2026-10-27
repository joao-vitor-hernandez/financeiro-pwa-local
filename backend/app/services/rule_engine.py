import re
import uuid

from app.models.categorization_rule import CategorizationRule

# Prefixos e ruídos comuns encontrados em extratos bancários brasileiros
COMMON_BANK_PREFIXES = [
    r"^PAG\*\s*",
    r"^PG\*\s*",
    r"^COMPRA\s+(?:COM\s+)?CARTAO\s+-\s*",
    r"^COMPRA\s+(?:NO\s+)?DEBITO\s+-\s*",
    r"^COMPRA\s+(?:NO\s+)?CREDITO\s+-\s*",
    r"^PIX\s+ENVIADO\s+-\s*",
    r"^PIX\s+RECEBIDO\s+-\s*",
    r"^TED\s+ENVIADA\s+-\s*",
    r"^DOC\s+ENVIADO\s+-\s*",
]


def sanitize_description(raw_description: str) -> str:
    """
    Remove ruídos comuns de adquirentes e processadoras de pagamento (PAG*, PG*, etc.),
    normalizando espaços múltiplos e pontuações periféricas.
    """
    if not raw_description:
        return ""

    cleaned = raw_description.strip()
    for prefix in COMMON_BANK_PREFIXES:
        cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE)

    # Remover múltiplos espaços em branco consecutivos
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def match_categorization_rule(
    raw_description: str, rules: list[CategorizationRule]
) -> tuple[uuid.UUID | None, str]:
    """
    Avalia a descrição contra uma lista de regras determinísticas ordenada por prioridade (menor número = maior prioridade).

    Retorna:
    (category_id_correspondente, descricao_higienizada)
    """
    cleaned_desc = sanitize_description(raw_description)

    # Ordenar por prioridade crescente para garantir determinismo
    sorted_rules = sorted(rules, key=lambda r: r.priority)

    for rule in sorted_rules:
        if not rule.is_active:
            continue

        try:
            # Avaliação case-insensitive do padrão Regex
            if re.search(rule.pattern, raw_description, flags=re.IGNORECASE):
                # Se a regra tiver uma descrição amigável explícita, usa ela; senão usa a higienizada
                final_description = (
                    rule.clean_description if rule.clean_description else cleaned_desc
                )
                return rule.category_id, final_description
        except re.error:
            # Ignora padrões de regex inválidos para não interromper o pipeline
            continue

    return None, cleaned_desc
