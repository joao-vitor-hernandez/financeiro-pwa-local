import asyncio
import os
import sys

# Garante que o diretório backend esteja no PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category, CategoryType

DEFAULT_CATEGORIES = [
    # Despesas (10)
    {
        "name": "Alimentação & Restaurantes",
        "type": CategoryType.EXPENSE,
        "icon": "coffee",
        "color": "#21D0B2",
    },
    {
        "name": "Supermercado & Mercado",
        "type": CategoryType.EXPENSE,
        "icon": "shopping-cart",
        "color": "#1DCDFE",
    },
    {
        "name": "Transporte & Mobilidade",
        "type": CategoryType.EXPENSE,
        "icon": "truck",
        "color": "#34F5C5",
    },
    {
        "name": "Moradia & Contas Fixas",
        "type": CategoryType.EXPENSE,
        "icon": "home",
        "color": "#fbbf24",
    },
    {
        "name": "Saúde & Farmácia",
        "type": CategoryType.EXPENSE,
        "icon": "heart",
        "color": "#f43f5e",
    },
    {
        "name": "Assinaturas & Serviços (SaaS)",
        "type": CategoryType.EXPENSE,
        "icon": "film",
        "color": "#a855f7",
    },
    {
        "name": "Lazer & Entretenimento",
        "type": CategoryType.EXPENSE,
        "icon": "compass",
        "color": "#ec4899",
    },
    {
        "name": "Educação & Cursos",
        "type": CategoryType.EXPENSE,
        "icon": "book",
        "color": "#38bdf8",
    },
    {
        "name": "Compras & Tecnologia",
        "type": CategoryType.EXPENSE,
        "icon": "laptop",
        "color": "#f97316",
    },
    {
        "name": "Despesas Pessoais & Cuidados",
        "type": CategoryType.EXPENSE,
        "icon": "user",
        "color": "#94a3b8",
    },
    # Receitas (4)
    {
        "name": "Salário & Remuneração",
        "type": CategoryType.INCOME,
        "icon": "wallet",
        "color": "#21D0B2",
    },
    {
        "name": "Rendimentos & Dividendos",
        "type": CategoryType.INCOME,
        "icon": "chart",
        "color": "#1DCDFE",
    },
    {
        "name": "Freelance & Serviços Extras",
        "type": CategoryType.INCOME,
        "icon": "dollar-sign",
        "color": "#34F5C5",
    },
    {
        "name": "Outras Entradas & Reembolsos",
        "type": CategoryType.INCOME,
        "icon": "plus",
        "color": "#a855f7",
    },
]


async def seed_categories() -> dict[str, Category]:
    print("Iniciando seed de categorias padrão...")
    inserted_categories: dict[str, Category] = {}

    async with AsyncSessionLocal() as session:
        for cat_data in DEFAULT_CATEGORIES:
            # Verifica se já existe por nome
            stmt = select(Category).where(Category.name == cat_data["name"])
            res = await session.execute(stmt)
            existing = res.scalars().first()

            if not existing:
                category = Category(
                    name=cat_data["name"],
                    type=cat_data["type"],
                    icon=cat_data["icon"],
                    color=cat_data["color"],
                    is_active=True,
                )
                session.add(category)
                await session.flush()
                await session.refresh(category)
                inserted_categories[category.name] = category
                print(f"  + Categoria criada: {category.name} ({category.type.value})")
            else:
                inserted_categories[existing.name] = existing
                print(f"  = Categoria já existente: {existing.name}")

        # Seed inicial de regras inteligentes recomendadas
        initial_rules = [
            {
                "name": "Corridas Uber & 99",
                "pattern": r"uber|99app|99pop|cabify",
                "clean_description": "Uber / 99 Viagens",
                "category_name": "Transporte & Mobilidade",
                "priority": 10,
            },
            {
                "name": "Delivery iFood & Rappi",
                "pattern": r"ifood|rappi|aiqfome",
                "clean_description": "Delivery de Comida",
                "category_name": "Alimentação & Restaurantes",
                "priority": 20,
            },
            {
                "name": "Streaming Netflix, Spotify & Prime",
                "pattern": r"netflix|spotify|prime\s*video|disney\+|max\s*br",
                "clean_description": "Assinatura de Streaming",
                "category_name": "Assinaturas & Serviços (SaaS)",
                "priority": 30,
            },
            {
                "name": "Farmácias & Drogarias",
                "pattern": r"drogasil|droga\s*raia|pague\s*menos|sao\s*paulo\s*drogaria|panvel",
                "clean_description": "Farmácia / Medicamentos",
                "category_name": "Saúde & Farmácia",
                "priority": 40,
            },
            {
                "name": "Supermercados & Atacadistas",
                "pattern": r"carrefour|pao\s*de\s*acucar|assa[ií]|atacad[aã]o|sams\s*club",
                "clean_description": "Compras de Supermercado",
                "category_name": "Supermercado & Mercado",
                "priority": 50,
            },
        ]

        for rule_data in initial_rules:
            cat = inserted_categories.get(rule_data["category_name"])
            if not cat:
                continue

            stmt = select(CategorizationRule).where(CategorizationRule.name == rule_data["name"])
            res = await session.execute(stmt)
            existing_rule = res.scalars().first()

            if not existing_rule:
                rule = CategorizationRule(
                    name=rule_data["name"],
                    pattern=rule_data["pattern"],
                    clean_description=rule_data["clean_description"],
                    category_id=cat.id,
                    priority=rule_data["priority"],
                    is_active=True,
                )
                session.add(rule)
                print(f"  + Regra criada: {rule.name} -> {cat.name}")

        await session.commit()
        print("Seed concluído com sucesso!")
        return inserted_categories


if __name__ == "__main__":
    asyncio.run(seed_categories())

