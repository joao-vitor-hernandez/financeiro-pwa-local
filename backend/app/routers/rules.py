import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.categorization_rule import CategorizationRule
from app.schemas.categorization_rule import (
    CategorizationRuleCreate,
    CategorizationRuleResponse,
    CategorizationRuleUpdate,
)

router = APIRouter(prefix="/rules", tags=["Categorization Rules"])


@router.get("", response_model=list[CategorizationRuleResponse])
async def list_rules(db: AsyncSession = Depends(get_db)):
    stmt = select(CategorizationRule).order_by(
        CategorizationRule.priority.asc(), CategorizationRule.name.asc()
    )
    result = await db.execute(stmt)
    return result.scalars().all()


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
    return rule


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
    return rule


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
