from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_dependency import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_pin, verify_pin
from app.models.user import User
from app.schemas.auth import (
    AuthStatusResponse,
    PinLoginRequest,
    PinSetupRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Autenticação & Segurança"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status(db: AsyncSession = Depends(get_db)):
    """
    Informa se o PIN mestre já foi configurado no sistema.
    """
    stmt = select(User).limit(1)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        return AuthStatusResponse(
            is_setup=False,
            email=settings.PRIMARY_USER_EMAIL,
        )

    return AuthStatusResponse(
        is_setup=True,
        email=user.email,
    )


@router.post("/setup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def setup_pin(payload: PinSetupRequest, db: AsyncSession = Depends(get_db)):
    """
    Configuração inicial do PIN mestre de 6 dígitos para o proprietário do sistema.
    Permitido apenas se nenhum usuário existir no banco de dados.
    """
    stmt = select(User).limit(1)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O PIN do sistema já foi configurado previamente.",
        )

    # Gera o hash seguro com BCrypt rounds=12
    hashed = hash_pin(payload.pin)

    new_user = User(
        email=settings.PRIMARY_USER_EMAIL,
        pin_hash=hashed,
        failed_attempts=0,
        locked_until=None,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Emite o token JWT
    token = create_access_token(data={"sub": new_user.email})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def pin_login(payload: PinLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Autenticação via PIN de 6 dígitos com proteção contra ataques de força bruta.
    Bloqueio automático temporário após 5 tentativas incorretas consecutivas.
    """
    stmt = select(User).where(User.email == settings.PRIMARY_USER_EMAIL)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sistema não inicializado. Configure o PIN mestre primeiro.",
        )

    now = datetime.now(UTC)

    # Verifica bloqueio por força bruta
    if user.locked_until and user.locked_until > now:
        remaining_seconds = int((user.locked_until - now).total_seconds())
        remaining_minutes = max(1, remaining_seconds // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"PIN bloqueado temporariamente por excesso de tentativas. Tente novamente em {remaining_minutes} minuto(s).",
        )

    # Validação do PIN com BCrypt
    is_valid = verify_pin(payload.pin, user.pin_hash)

    if not is_valid:
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"PIN incorreto. Limite de {MAX_FAILED_ATTEMPTS} tentativas atingido. Bloqueado por {LOCKOUT_MINUTES} minutos.",
            )

        await db.commit()
        remaining = MAX_FAILED_ATTEMPTS - user.failed_attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"PIN incorreto. Você tem mais {remaining} tentativa(s) antes do bloqueio temporário.",
        )

    # Sucesso: zera tentativas falhas e remove qualquer bloqueio
    user.failed_attempts = 0
    user.locked_until = None
    await db.commit()

    token = create_access_token(data={"sub": user.email})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_authenticated_user(current_user: User = Depends(get_current_user)):
    """
    Retorna os dados do usuário atualmente autenticado via JWT.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
    )
