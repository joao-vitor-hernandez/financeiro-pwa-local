import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import AsyncSessionLocal
from app.services.sync_service import sync_all_accounts

logger = logging.getLogger("sync_worker")

scheduler = AsyncIOScheduler()


async def scheduled_sync_job():
    """
    Rotina periódica de background para ingestão automática de extratos via Pluggy.
    """
    logger.info("Iniciando rotina agendada de sincronização com Open Finance...")
    try:
        async with AsyncSessionLocal() as session:
            results = await sync_all_accounts(session=session)
            await session.commit()
            logger.info("Sincronização agendada finalizada com sucesso: %s", results)
    except Exception as exc:
        logger.error("Erro durante a execução da sincronização agendada: %s", exc, exc_info=True)


def start_sync_scheduler(interval_hours: int = 12):
    """
    Inicia o agendador em background.
    """
    if not scheduler.running:
        scheduler.add_job(
            scheduled_sync_job,
            trigger=IntervalTrigger(hours=interval_hours),
            id="pluggy_sync_job",
            name="Sincronização periódica Pluggy Open Finance",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Agendador de sincronização iniciado (intervalo: %dh).", interval_hours)


def stop_sync_scheduler():
    """
    Finaliza o agendador de forma graciosa.
    """
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Agendador de sincronização finalizado.")
