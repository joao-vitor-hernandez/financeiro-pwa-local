from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import AsyncSessionLocal
from app.services.web_push_service import check_due_bills_and_notify

logger = logging.getLogger("push_worker")

push_scheduler = AsyncIOScheduler()


async def scheduled_push_check_job():
    """
    Rotina periódica disparada às 09:00 e 18:00 (America/Sao_Paulo / UTC-3).
    Varre faturas com vencimento em D-0 e D-1 e dispara os alertas push de alta prioridade.
    """
    logger.info("Executando checagem agendada de vencimentos para Web Push...")
    try:
        async with AsyncSessionLocal() as session:
            alerts = await check_due_bills_and_notify(session)
            logger.info("Checagem de vencimentos concluída. Alertas processados: %d", len(alerts))
    except Exception as exc:
        logger.error("Erro durante a checagem agendada de vencimentos: %s", exc, exc_info=True)


def start_push_scheduler():
    """
    Inicia o agendador de notificações push nos horários definidos pelo roadmap:
    09:00 e 18:00 no fuso de Brasília (America/Sao_Paulo).
    """
    if not push_scheduler.running:
        push_scheduler.add_job(
            scheduled_push_check_job,
            trigger=CronTrigger(hour="9,18", minute=0, timezone="America/Sao_Paulo"),
            id="bill_due_push_job",
            name="Notificações Push de Vencimento de Faturas (09h e 18h BRT)",
            replace_existing=True,
        )
        push_scheduler.start()
        logger.info("Agendador de notificações Web Push iniciado (Cron: 09:00 e 18:00 America/Sao_Paulo).")


def stop_push_scheduler():
    """
    Finaliza o agendador de notificações push de forma graciosa.
    """
    if push_scheduler.running:
        push_scheduler.shutdown(wait=False)
        logger.info("Agendador de notificações Web Push finalizado.")
