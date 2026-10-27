import uuid

from pydantic import BaseModel, Field


class PinLoginRequest(BaseModel):
    pin: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="PIN numérico de exatamente 6 dígitos",
    )


class PinSetupRequest(BaseModel):
    pin: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="PIN numérico de exatamente 6 dígitos para configuração inicial",
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthStatusResponse(BaseModel):
    is_setup: bool
    email: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    is_active: bool
