import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.category import CategoryType


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: CategoryType
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    parent_id: uuid.UUID | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = None
    color: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool | None = None


class CategoryResponse(CategoryBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    subcategories: list["CategoryResponse"] = []

    model_config = ConfigDict(from_attributes=True)
