from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.asset_allocation import (
    AssetAllocationSummaryResponse,
    AssetAllocationTargetResponse,
    AssetAllocationTargetUpdate,
)
from app.services.asset_allocation_service import AssetAllocationService

router = APIRouter(prefix="/assets", tags=["Alocação de Ativos & Benchmark CDI (Fase 8.4)"])


@router.get("/allocation", response_model=AssetAllocationSummaryResponse)
async def get_asset_allocation(db: AsyncSession = Depends(get_db)):
    """
    Retorna o sumário de alocação de ativos patrimoniais, rebalanceamento recomendado
    e benchmark de rendimento dos cofrinhos contra a taxa CDI e a poupança.
    """
    return await AssetAllocationService.get_allocation_summary(db)


@router.put("/allocation/targets", response_model=AssetAllocationTargetResponse)
async def update_asset_allocation_targets(
    payload: AssetAllocationTargetUpdate, db: AsyncSession = Depends(get_db)
):
    """
    Atualiza as metas percentuais de alocação (Caixa, Cofrinhos, Investimentos)
    e a taxa anual do CDI utilizada como benchmark de rentabilidade.
    Garante validação estrita (soma das metas = 100%).
    """
    return await AssetAllocationService.update_targets(db, payload)
