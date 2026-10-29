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
    category_name: str | None = None
    category_icon: str | None = None
    category_color: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RuleSimulationRequest(BaseModel):
    raw_text: str = Field(..., min_length=1, max_length=255)
    candidate_pattern: str | None = Field(default=None, max_length=255)
    candidate_clean_description: str | None = Field(default=None, max_length=100)
    candidate_category_id: uuid.UUID | None = None

    @field_validator("candidate_pattern")
    @classmethod
    def validate_candidate_pattern(cls, v: str | None) -> str | None:
        if v:
            try:
                re.compile(v)
            except re.error as exc:
                raise ValueError(f"Sintaxe de expressão regular inválida: {exc}")
        return v


class RuleSimulationResponse(BaseModel):
    raw_text: str
    sanitized_text: str
    is_match: bool
    matched_rule_id: uuid.UUID | None = None
    matched_rule_name: str | None = None
    matched_rule_priority: int | None = None
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    category_icon: str | None = None
    category_color: str | None = None
    final_description: str


class RuleReorderRequest(BaseModel):
    rule_ids: list[uuid.UUID] = Field(..., min_length=1)
