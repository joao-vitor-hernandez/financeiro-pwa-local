import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    transaction_id: uuid.UUID
    file_name: str
    file_size_bytes: int
    mime_type: str
    view_url: str
    created_at: datetime


class AttachmentListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attachments: list[AttachmentResponse]
    total_count: int
