from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

import app.models  # Garante que todos os modelos sejam importados
from app.core.auth_dependency import get_current_user
from app.core.config import settings
from app.core.database import Base, engine
from app.routers import (
    accounts,
    auth,
    bills,
    budgets,
    categories,
    dashboard,
    goals,
    rules,
    sync,
    transactions,
    webhooks,
)
from app.services.sync_worker import start_sync_scheduler, stop_sync_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialização: criar tabelas se não existirem
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Iniciar agendador de sincronização apenas se credenciais estiverem configuradas
    if settings.PLUGGY_CLIENT_ID and settings.PLUGGY_CLIENT_SECRET:
        start_sync_scheduler(interval_hours=12)

    yield

    # Finalização: parar agendador e fechar pool de conexões
    stop_sync_scheduler()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="API do Sistema Financeiro Pessoal PWA com Precisão Decimal Arbitrária e Open Finance",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Middleware defensivo de cabeçalhos de segurança (OWASP Secure Headers).
    Protege contra clickjacking, MIME sniffing, injeção de scripts e vazamento de referrer.
    """
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# CORS Middleware com restrição estrita de origens
# Em dev: aceita requisições do Angular local (http://localhost:4200)
# Em prod: aceita apenas o domínio próprio e subdomínios oficiais do projeto no Cloudflare Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "https://financeiro.entrefilas.com.br",
        "https://financeiro-pwa-local.pages.dev",
    ],
    allow_origin_regex=r"^https:\/\/([a-zA-Z0-9\-]+\.)?financeiro-pwa-local\.pages\.dev$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Inclusão dos roteadores da API
# Rotas públicas de autenticação e webhooks externos
app.include_router(auth.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")

# Rotas financeiras protegidas com autenticação JWT obrigatória
auth_deps = [Depends(get_current_user)]
app.include_router(accounts.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(categories.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(bills.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(transactions.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(dashboard.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(rules.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(sync.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(budgets.router, prefix="/api/v1", dependencies=auth_deps)
app.include_router(goals.router, prefix="/api/v1", dependencies=auth_deps)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "app": settings.APP_NAME,
    }
