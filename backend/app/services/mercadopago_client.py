from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Any

import httpx
from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.core.config import settings
from app.models.transaction import TransactionType

logger = logging.getLogger(__name__)


class MercadoPagoMovementDTO(BaseModel):
    fitid: str
    description: str
    amount: Decimal
    transaction_date: datetime
    type: TransactionType
    raw_status: str | None = None
    raw_data: dict[str, Any] | None = None

    model_config = ConfigDict(extra="forbid")


class MercadoPagoSearchResponse(BaseModel):
    total: int
    limit: int
    offset: int
    results: list[MercadoPagoMovementDTO]

    model_config = ConfigDict(extra="forbid")


class MercadoPagoClient:
    """
    Cliente HTTP assíncrono para consumo da API Oficial REST do Mercado Pago.
    Permite busca de movimentações e conciliação bancária via Bearer Token.
    """

    def __init__(self):
        self.base_url = settings.MERCADOPAGO_BASE_URL.rstrip("/")
        self.access_token = settings.MERCADOPAGO_ACCESS_TOKEN
        self.user_id = settings.MERCADOPAGO_USER_ID

    def is_configured(self) -> bool:
        return bool(self.access_token)

    def _get_headers(self) -> dict[str, str]:
        if not self.is_configured():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MERCADOPAGO_ACCESS_TOKEN não está configurado nas variáveis de ambiente (.env).",
            )
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "User-Agent": f"{settings.APP_NAME}-Connector/1.0",
        }

    async def get_account_movements(
        self,
        begin_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> MercadoPagoSearchResponse:
        """
        Consulta o histórico de movimentações da conta no Mercado Pago via /v1/account/movements/search.
        """
        headers = self._get_headers()
        params: dict[str, Any] = {
            "range": "date_created",
            "limit": limit,
            "offset": offset,
        }
        if begin_date:
            params["begin_date"] = begin_date.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        if end_date:
            params["end_date"] = end_date.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            params["end_date"] = "NOW"

        endpoint = f"{self.base_url}/v1/account/movements/search"

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.get(endpoint, headers=headers, params=params)
                if res.status_code != 200:
                    logger.error(
                        "Falha na API do Mercado Pago: status=%d body=%s",
                        res.status_code,
                        res.text,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Erro ao consultar movimentações no Mercado Pago: HTTP {res.status_code}",
                    )

                data = res.json()
            except httpx.RequestError as exc:
                logger.error("Falha de conexão com a API do Mercado Pago: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Serviço do Mercado Pago temporariamente inacessível.",
                ) from exc

        results = data.get("results", [])
        mapped_movements: list[MercadoPagoMovementDTO] = []

        for item in results:
            movement_id = str(item.get("id") or item.get("reference_id") or "")
            raw_amt = Decimal(str(item.get("amount", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            )

            # No Mercado Pago, saídas podem ter amount negativo ou tipo específico
            mov_type_str = str(item.get("type", "")).lower()
            if raw_amt < Decimal("0.00") or any(
                k in mov_type_str for k in ("out", "payment", "withdrawal", "debit")
            ):
                tx_type = TransactionType.EXPENSE
                final_amt = abs(raw_amt)
            else:
                tx_type = TransactionType.INCOME
                final_amt = raw_amt

            # Data de criação
            date_raw = item.get("date_created")
            try:
                tx_date = (
                    datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
                    if date_raw
                    else datetime.now(UTC)
                )
            except Exception:
                tx_date = datetime.now(UTC)

            description = (
                item.get("detail")
                or item.get("description")
                or item.get("reason")
                or "Movimentação Mercado Pago"
            ).strip()

            mapped_movements.append(
                MercadoPagoMovementDTO(
                    fitid=f"MP-{movement_id}",
                    description=description,
                    amount=final_amt,
                    transaction_date=tx_date,
                    type=tx_type,
                    raw_status=item.get("status"),
                    raw_data=item,
                )
            )

        return MercadoPagoSearchResponse(
            total=data.get("paging", {}).get("total", len(mapped_movements)),
            limit=limit,
            offset=offset,
            results=mapped_movements,
        )
