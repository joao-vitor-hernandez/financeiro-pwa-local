import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    # Retorna apenas categorias principais com suas subcategorias carregadas
    stmt = (
        select(Category)
        .where(Category.is_active.is_(True), Category.parent_id.is_(None))
        .options(selectinload(Category.subcategories))
        .order_by(Category.name)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(cat_in: CategoryCreate, db: AsyncSession = Depends(get_db)):
    category = Category(
        name=cat_in.name,
        type=cat_in.type,
        icon=cat_in.icon,
        color=cat_in.color,
        parent_id=cat_in.parent_id,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID, cat_in: CategoryUpdate, db: AsyncSession = Depends(get_db)
):
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")

    update_data = cat_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    await db.flush()
    await db.refresh(category)
    return category
