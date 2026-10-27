from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


class PluggyClient:
    """
    Cliente assíncrono para comunicação com a API Open Finance da Pluggy.
    Gerencia autenticação automática, cache do token de sessão e paginação de dados.
    """

    def __init__(self):
        self.base_url = settings.PLUGGY_BASE_URL.rstrip("/")
        self.client_id = settings.PLUGGY_CLIENT_ID
        self.client_secret = settings.PLUGGY_CLIENT_SECRET
        self._cached_api_key: str | None = None
        self._token_expires_at: datetime | None = None

    def _is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def get_api_key(self) -> str:
        """
        Obtém ou renova o token de autenticação (apiKey) da Pluggy.
        """
        if not self._is_configured():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credenciais da Pluggy (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET) não estão configuradas no .env.",
            )

        now = datetime.now(UTC)
        # Se temos token em cache válido por mais de 5 minutos, reutiliza
        if (
            self._cached_api_key
            and self._token_expires_at
            and (self._token_expires_at - now) > timedelta(minutes=5)
        ):
            return self._cached_api_key

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.post(
                    f"{self.base_url}/auth",
                    json={"clientId": self.client_id, "clientSecret": self.client_secret},
                )
                if res.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Falha de autenticação na Pluggy: {res.text}",
                    )

                data = res.json()
                self._cached_api_key = data.get("apiKey")
                # Token da Pluggy dura cerca de 2 horas; cacheamos por 1h45m
                self._token_expires_at = now + timedelta(minutes=105)
                return self._cached_api_key
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Erro de conexão com o serviço da Pluggy: {exc}",
                )

    async def fetch_accounts(self, item_id: str | None = None) -> list[dict[str, Any]]:
        """
        Consulta as contas bancárias sincronizadas via Open Finance.
        """
        api_key = await self.get_api_key()
        headers = {"X-API-KEY": api_key}
        params = {}
        if item_id:
            params["itemId"] = item_id

        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(f"{self.base_url}/accounts", headers=headers, params=params)
            if res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro ao consultar contas na Pluggy: {res.text}",
                )
            return res.json().get("results", [])

    async def fetch_transactions(
        self, account_id: str, from_date: str | None = None, page: int = 1
    ) -> dict[str, Any]:
        """
        Consulta os lançamentos de uma conta específica na Pluggy.
        from_date deve estar no formato ISO (YYYY-MM-DD).
        """
        api_key = await self.get_api_key()
        headers = {"X-API-KEY": api_key}
        params: dict[str, Any] = {"accountId": account_id, "page": page}
        if from_date:
            params["from"] = from_date

        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(f"{self.base_url}/transactions", headers=headers, params=params)
            if res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro ao consultar transações na Pluggy: {res.text}",
                )
            return res.json()


pluggy_client = PluggyClient()
