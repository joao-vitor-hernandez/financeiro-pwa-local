import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.schemas.categorization_rule import (
    CategorizationRuleCreate,
    CategorizationRuleResponse,
    CategorizationRuleUpdate,
    RuleReorderRequest,
    RuleSimulationRequest,
    RuleSimulationResponse,
)
from app.services.rule_engine import sanitize_description

router = APIRouter(prefix="/rules", tags=["Categorization Rules"])


def _build_rule_response(rule: CategorizationRule) -> CategorizationRuleResponse:
    category_name = rule.category.name if rule.category else None
    category_icon = rule.category.icon if rule.category else None
    category_color = rule.category.color if rule.category else None
    return CategorizationRuleResponse(
        id=rule.id,
        name=rule.name,
        pattern=rule.pattern,
        clean_description=rule.clean_description,
        category_id=rule.category_id,
        priority=rule.priority,
        is_active=rule.is_active,
        created_at=rule.created_at,
        category_name=category_name,
        category_icon=category_icon,
        category_color=category_color,
    )


@router.get("", response_model=list[CategorizationRuleResponse])
async def list_rules(db: AsyncSession = Depends(get_db)):
    stmt = select(CategorizationRule).order_by(
        CategorizationRule.priority.asc(), CategorizationRule.name.asc()
    )
    result = await db.execute(stmt)
    rules = result.scalars().all()
    return [_build_rule_response(r) for r in rules]


@router.post("", response_model=CategorizationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(rule_in: CategorizationRuleCreate, db: AsyncSession = Depends(get_db)):
    rule = CategorizationRule(
        name=rule_in.name,
        pattern=rule_in.pattern,
        clean_description=rule_in.clean_description,
        category_id=rule_in.category_id,
        priority=rule_in.priority,
        is_active=rule_in.is_active,
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)

    # Recarrega para popular o relacionamento com category
    stmt = select(CategorizationRule).where(CategorizationRule.id == rule.id)
    res = await db.execute(stmt)
    loaded_rule = res.scalars().first() or rule
    return _build_rule_response(loaded_rule)


@router.patch("/{rule_id}", response_model=CategorizationRuleResponse)
async def update_rule(
    rule_id: uuid.UUID, rule_in: CategorizationRuleUpdate, db: AsyncSession = Depends(get_db)
):
    stmt = select(CategorizationRule).where(CategorizationRule.id == rule_id)
    res = await db.execute(stmt)
    rule = res.scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada.")

    update_data = rule_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(rule, field, val)

    await db.flush()
    await db.refresh(rule)

    stmt = select(CategorizationRule).where(CategorizationRule.id == rule.id)
    res = await db.execute(stmt)
    loaded_rule = res.scalars().first() or rule
    return _build_rule_response(loaded_rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(CategorizationRule).where(CategorizationRule.id == rule_id)
    res = await db.execute(stmt)
    rule = res.scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada.")

    await db.delete(rule)
    await db.flush()
    return None


@router.post("/simulate", response_model=RuleSimulationResponse)
async def simulate_rule(sim_in: RuleSimulationRequest, db: AsyncSession = Depends(get_db)):
    sanitized = sanitize_description(sim_in.raw_text)

    # 1. Modo Sandbox de Padrão Candidato (teste ao vivo no modal de criação/edição)
    if sim_in.candidate_pattern:
        try:
            matched = bool(re.search(sim_in.candidate_pattern, sim_in.raw_text, flags=re.IGNORECASE))
        except re.error:
            matched = False

        if matched:
            cat_name = None
            cat_icon = None
            cat_color = None
            if sim_in.candidate_category_id:
                cat = await db.get(Category, sim_in.candidate_category_id)
                if cat:
                    cat_name = cat.name
                    cat_icon = cat.icon
                    cat_color = cat.color

            final_desc = (
                sim_in.candidate_clean_description.strip()
                if sim_in.candidate_clean_description
                else sanitized
            )
            return RuleSimulationResponse(
                raw_text=sim_in.raw_text,
                sanitized_text=sanitized,
                is_match=True,
                matched_rule_id=None,
                matched_rule_name="Regra em Teste",
                matched_rule_priority=None,
                category_id=sim_in.candidate_category_id,
                category_name=cat_name,
                category_icon=cat_icon,
                category_color=cat_color,
                final_description=final_desc,
            )
        else:
            return RuleSimulationResponse(
                raw_text=sim_in.raw_text,
                sanitized_text=sanitized,
                is_match=False,
                final_description=sanitized,
            )

    # 2. Modo Simulação Geral contra todas as regras ativas ordenadas por prioridade crescente
    stmt = (
        select(CategorizationRule)
        .where(CategorizationRule.is_active.is_(True))
        .order_by(CategorizationRule.priority.asc())
    )
    res = await db.execute(stmt)
    active_rules = res.scalars().all()

    for rule in active_rules:
        try:
            if re.search(rule.pattern, sim_in.raw_text, flags=re.IGNORECASE):
                final_desc = (
                    rule.clean_description.strip() if rule.clean_description else sanitized
                )
                return RuleSimulationResponse(
                    raw_text=sim_in.raw_text,
                    sanitized_text=sanitized,
                    is_match=True,
                    matched_rule_id=rule.id,
                    matched_rule_name=rule.name,
                    matched_rule_priority=rule.priority,
                    category_id=rule.category_id,
                    category_name=rule.category.name if rule.category else None,
                    category_icon=rule.category.icon if rule.category else None,
                    category_color=rule.category.color if rule.category else None,
                    final_description=final_desc,
                )
        except re.error:
            continue

    return RuleSimulationResponse(
        raw_text=sim_in.raw_text,
        sanitized_text=sanitized,
        is_match=False,
        final_description=sanitized,
    )


@router.post("/reorder", response_model=list[CategorizationRuleResponse])
async def reorder_rules(reorder_in: RuleReorderRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(CategorizationRule).where(CategorizationRule.id.in_(reorder_in.rule_ids))
    res = await db.execute(stmt)
    rules_map = {rule.id: rule for rule in res.scalars().all()}

    for index, rule_id in enumerate(reorder_in.rule_ids):
        rule = rules_map.get(rule_id)
        if rule:
            rule.priority = (index + 1) * 10

    await db.flush()

    fetch_stmt = select(CategorizationRule).order_by(
        CategorizationRule.priority.asc(), CategorizationRule.name.asc()
    )
    fetch_res = await db.execute(fetch_stmt)
    all_rules = fetch_res.scalars().all()
    return [_build_rule_response(r) for r in all_rules]
