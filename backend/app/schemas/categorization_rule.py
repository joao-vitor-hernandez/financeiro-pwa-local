import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CategorizationRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    pattern: str = Field(..., min_length=1, max_length=255)
    clean_description: str | None = Field(default=None, max_length=100)
    category_id: uuid.UUID
    priority: int = Field(default=100, ge=1, le=1000)
    is_active: bool = True

    @field_validator("pattern")
    @classmethod
    def validate_regex_pattern(cls, v: str) -> str:
        try:
            re.compile(v)
        except re.error as exc:
            raise ValueError(f"Sintaxe de expressão regular inválida: {exc}")
        return v


class CategorizationRuleCreate(CategorizationRuleBase):
    pass


class CategorizationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    pattern: str | None = Field(default=None, min_length=1, max_length=255)
    clean_description: str | None = None
    category_id: uuid.UUID | None = None
    priority: int | None = Field(default=None, ge=1, le=1000)
    is_active: bool | None = None

    @field_validator("pattern")
    @classmethod
    def validate_regex_pattern(cls, v: str | None) -> str | None:
        if v is not None:
            try:
                re.compile(v)
            except re.error as exc:
                raise ValueError(f"Sintaxe de expressão regular inválida: {exc}")
        return v


class CategorizationRuleResponse(CategorizationRuleBase):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
