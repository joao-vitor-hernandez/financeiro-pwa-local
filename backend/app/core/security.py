from datetime import UTC, datetime, timedelta

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_pin(pin: str) -> str:
    """
    Gera um hash BCrypt com salt aleatório e fator de custo rounds=12.
    Proteção robusta contra ataques de dicionário e força bruta em PINs de 6 dígitos.
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(pin.encode("utf-8"), salt)
    return hashed_bytes.decode("utf-8")


def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """
    Verifica se o PIN informado confere com o hash BCrypt gravado no banco.
    """
    try:
        return bcrypt.checkpw(
            plain_pin.encode("utf-8"),
            hashed_pin.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Emite um token JWT assinado digitalmente com a chave secreta do servidor.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Valida e decodifica o payload do token JWT.
    Lança JWTError se expirado, corrompido ou com assinatura inválida.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
