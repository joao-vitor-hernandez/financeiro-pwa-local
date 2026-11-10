from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

STATUS_TITLES: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "Requisição Inválida",
    status.HTTP_401_UNAUTHORIZED: "Não Autorizado",
    status.HTTP_403_FORBIDDEN: "Acesso Proibido",
    status.HTTP_404_NOT_FOUND: "Recurso Não Encontrado",
    status.HTTP_409_CONFLICT: "Conflito de Estado",
    422: "Erro de Validação Semântica",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "Erro Interno do Servidor",
}


def create_problem_payload(
    status_code: int,
    title: str,
    detail: str,
    instance: str,
    error_type: str | None = None,
    invalid_params: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": error_type or f"https://clarifin.app/errors/{status_code}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if invalid_params:
        payload["invalidParams"] = invalid_params
    return payload


def problem_response(
    status_code: int,
    title: str,
    detail: str,
    instance: str,
    error_type: str | None = None,
    invalid_params: list[dict[str, str]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=create_problem_payload(
            status_code=status_code,
            title=title,
            detail=detail,
            instance=instance,
            error_type=error_type,
            invalid_params=invalid_params,
        ),
        media_type="application/problem+json",
    )


def setup_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        title = STATUS_TITLES.get(exc.status_code, "Erro na Operação")
        detail = str(exc.detail) if exc.detail else title
        return problem_response(
            status_code=exc.status_code,
            title=title,
            detail=detail,
            instance=request.url.path,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        invalid_params = []
        for error in exc.errors():
            loc_parts = [str(part) for part in error.get("loc", []) if part != "body"]
            field_name = ".".join(loc_parts) if loc_parts else "body"
            invalid_params.append(
                {
                    "field": field_name,
                    "reason": error.get("msg", "Valor inválido"),
                }
            )

        return problem_response(
            status_code=422,
            title=STATUS_TITLES.get(422, "Erro de Validação"),
            detail="A requisição falhou na validação de entrada na borda da API.",
            instance=request.url.path,
            invalid_params=invalid_params,
        )
