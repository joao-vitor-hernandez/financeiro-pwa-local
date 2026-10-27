from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.summary import DashboardSummary
from app.services.summary_service import get_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(ref_date: datetime | None = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Retorna os dados consolidados para os cards executivos do Dashboard.
    """
    target_date = ref_date or datetime.now(UTC)
    return await get_dashboard_summary(session=db, reference_date=target_date)
