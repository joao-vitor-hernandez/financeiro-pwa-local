import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategorizationRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    pattern: str = Field(..., min_length=1, max_length=255)
    clean_description: str | None = Field(default=None, max_length=100)
    category_id: uuid.UUID
    priority: int = Field(default=100, ge=1, le=1000)
    is_active: bool = True


class CategorizationRuleCreate(CategorizationRuleBase):
    pass


class CategorizationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    pattern: str | None = Field(default=None, min_length=1, max_length=255)
    clean_description: str | None = None
    category_id: uuid.UUID | None = None
    priority: int | None = Field(default=None, ge=1, le=1000)
    is_active: bool | None = None


class CategorizationRuleResponse(CategorizationRuleBase):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
