from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.core.config import settings
from app.models.transaction import TransactionType

logger = logging.getLogger(__name__)


class InterSaldoResponse(BaseModel):
    disponivel: Decimal
    bloqueadoCheque: Decimal = Decimal("0.00")
    bloqueadoJudicial: Decimal = Decimal("0.00")
    bloqueadoAdministrativo: Decimal = Decimal("0.00")
    limite: Decimal = Decimal("0.00")

    model_config = ConfigDict(extra="forbid")


class InterTransacaoDTO(BaseModel):
    fitid: str
    description: str
    amount: Decimal
    transaction_date: datetime
    type: TransactionType
    tipo_operacao: str | None = None
    raw_data: dict[str, Any] | None = None

    model_config = ConfigDict(extra="forbid")


class InterExtratoResponse(BaseModel):
    total_encontrado: int
    transacoes: list[InterTransacaoDTO]

    model_config = ConfigDict(extra="forbid")


class InterClient:
    """
    Cliente HTTP assíncrono oficial com Mutual TLS (mTLS) para o Banco Inter PJ/PF.
    Consome autenticação OAuth2 mTLS, consulta de saldo em tempo real e extrato bancário.
    """

    def __init__(self):
        self.base_url = settings.INTER_BASE_URL.rstrip("/")
        self.client_id = settings.INTER_CLIENT_ID
        self.client_secret = settings.INTER_CLIENT_SECRET
        self.cert_path = settings.INTER_CERT_PATH
        self.key_path = settings.INTER_KEY_PATH

        self._cached_access_token: str | None = None
        self._token_expires_at: datetime | None = None

    def is_configured(self) -> bool:
        if not (self.client_id and self.client_secret and self.cert_path and self.key_path):
            return False
        return Path(self.cert_path).is_file() and Path(self.key_path).is_file()

    def _get_cert_tuple(self) -> tuple[str, str]:
        if not self.cert_path or not self.key_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Caminhos do certificado mTLS do Banco Inter (INTER_CERT_PATH / INTER_KEY_PATH) não estão configurados.",
            )
        cert_p = Path(self.cert_path)
        key_p = Path(self.key_path)
        if not cert_p.is_file() or not key_p.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivos de certificado mTLS do Banco Inter (.crt / .key) não foram localizados no sistema de arquivos.",
            )
        return (str(cert_p), str(key_p))

    def _create_mtls_client(self, timeout: float = 20.0) -> httpx.AsyncClient:
        certs = self._get_cert_tuple()
        return httpx.AsyncClient(cert=certs, timeout=timeout)

    async def get_access_token(self) -> str:
        """
        Obtém ou renova token OAuth2 via mTLS no endpoint /oauth/v2/token.
        """
        now = datetime.now(UTC)
        if (
            self._cached_access_token
            and self._token_expires_at
            and (self._token_expires_at - now) > timedelta(minutes=5)
        ):
            return self._cached_access_token

        async with self._create_mtls_client() as client:
            token_url = f"{self.base_url}/oauth/v2/token"
            payload = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "extrato.read saldo.read",
                "grant_type": "client_credentials",
            }
            try:
                res = await client.post(
                    token_url,
                    data=payload,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if res.status_code != 200:
                    logger.error("Falha ao obter token Inter: status=%d body=%s", res.status_code, res.text)
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Erro de autenticação mTLS com o Banco Inter: HTTP {res.status_code}",
                    )
                data = res.json()
                self._cached_access_token = data["access_token"]
                expires_in = int(data.get("expires_in", 3600))
                self._token_expires_at = now + timedelta(seconds=expires_in)
                return self._cached_access_token
            except httpx.RequestError as exc:
                logger.error("Erro de conexão mTLS com Banco Inter: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Falha de conexão de rede mTLS com a API do Banco Inter.",
                ) from exc

    async def get_saldo(self) -> InterSaldoResponse:
        """
        Consulta o saldo disponível da conta corrente no endpoint /banking/v2/saldo.
        """
        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

        async with self._create_mtls_client() as client:
            try:
                res = await client.get(f"{self.base_url}/banking/v2/saldo", headers=headers)
                if res.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Falha ao consultar saldo no Banco Inter: HTTP {res.status_code}",
                    )
                data = res.json()
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Inacessibilidade momentânea no serviço de saldo do Banco Inter.",
                ) from exc

        return InterSaldoResponse(
            disponivel=Decimal(str(data.get("disponivel", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            ),
            bloqueadoCheque=Decimal(str(data.get("bloqueadoCheque", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            ),
            bloqueadoJudicial=Decimal(str(data.get("bloqueadoJudicial", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            ),
            bloqueadoAdministrativo=Decimal(str(data.get("bloqueadoAdministrativo", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            ),
            limite=Decimal(str(data.get("limite", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            ),
        )

    async def get_extrato(
        self, data_inicio: date, data_fim: date | None = None
    ) -> InterExtratoResponse:
        """
        Consulta o extrato bancário por período no endpoint /banking/v2/extrato.
        """
        if not data_fim:
            data_fim = datetime.now(UTC).date()

        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        params = {
            "dataInicio": data_inicio.strftime("%Y-%m-%d"),
            "dataFim": data_fim.strftime("%Y-%m-%d"),
        }

        async with self._create_mtls_client() as client:
            try:
                res = await client.get(
                    f"{self.base_url}/banking/v2/extrato",
                    headers=headers,
                    params=params,
                )
                if res.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Falha ao consultar extrato no Banco Inter: HTTP {res.status_code}",
                    )
                data = res.json()
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Inacessibilidade momentânea no serviço de extrato do Banco Inter.",
                ) from exc

        transacoes_raw = data.get("transacoes", [])
        transacoes_dto: list[InterTransacaoDTO] = []

        for item in transacoes_raw:
            raw_amt = Decimal(str(item.get("valor", "0.00"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_EVEN
            )
            tipo_op = str(item.get("tipoOperacao", "")).upper()

            if tipo_op in ("D", "DEBITO") or raw_amt < Decimal("0.00"):
                tx_type = TransactionType.EXPENSE
                final_amt = abs(raw_amt)
            else:
                tx_type = TransactionType.INCOME
                final_amt = raw_amt

            dt_str = item.get("dataEntrada") or item.get("dataHoraTransacao")
            try:
                tx_date = (
                    datetime.strptime(dt_str[:10], "%Y-%m-%d").replace(tzinfo=UTC)
                    if dt_str
                    else datetime.now(UTC)
                )
            except Exception:
                tx_date = datetime.now(UTC)

            cod_tx = str(item.get("codigoTransacao") or "")
            description = (
                item.get("descricao")
                or item.get("titulo")
                or "Transação Banco Inter"
            ).strip()

            transacoes_dto.append(
                InterTransacaoDTO(
                    fitid=f"INTER-{cod_tx}" if cod_tx else f"INTER-{tx_date.strftime('%Y%m%d')}-{final_amt}-{hash(description)}",
                    description=description,
                    amount=final_amt,
                    transaction_date=tx_date,
                    type=tx_type,
                    tipo_operacao=tipo_op,
                    raw_data=item,
                )
            )

        return InterExtratoResponse(
            total_encontrado=len(transacoes_dto),
            transacoes=transacoes_dto,
        )
