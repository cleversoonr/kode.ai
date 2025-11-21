"""
Pydantic schemas for the Knowledge Base module.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, UUID4, field_validator, HttpUrl


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    language: Optional[str] = Field(default=None, max_length=16)
    embedding_model: Optional[str] = Field(default=None, max_length=255)
    chunk_size: int = Field(default=512, ge=64, le=4096)
    chunk_overlap: int = Field(default=128, ge=0, le=2048)
    config: Optional[Dict[str, Any]] = None


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    language: Optional[str] = Field(default=None, max_length=16)
    embedding_model: Optional[str] = Field(default=None, max_length=255)
    chunk_size: Optional[int] = Field(default=None, ge=64, le=4096)
    chunk_overlap: Optional[int] = Field(default=None, ge=0, le=2048)
    config: Optional[Dict[str, Any]] = None


class KnowledgeBaseResponse(BaseModel):
    id: UUID4
    client_id: UUID4
    name: str
    description: Optional[str]
    language: Optional[str]
    embedding_model: Optional[str]
    chunk_size: int
    chunk_overlap: int
    is_active: bool
    config: Dict[str, Any]
    created_by: Optional[UUID4]
    updated_by: Optional[UUID4]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class KnowledgeDocumentCreate(BaseModel):
    source_type: str = Field(..., description="upload, url or text")
    original_filename: Optional[str] = Field(default=None, max_length=255)
    source_url: Optional[str] = Field(default=None, max_length=2048)
    mime_type: Optional[str] = Field(default=None, max_length=255)
    checksum: Optional[str] = Field(default=None, max_length=255)
    storage_path: Optional[str] = Field(default=None, max_length=1024)
    content_preview: Optional[str] = Field(default=None, max_length=4000)
    metadata: Optional[Dict[str, Any]] = None

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, value: str) -> str:
        allowed = {"upload", "url", "text"}
        if value not in allowed:
            raise ValueError(f"source_type must be one of {', '.join(sorted(allowed))}")
        return value


class KnowledgeDocumentResponse(BaseModel):
    id: UUID4
    knowledge_base_id: UUID4
    client_id: UUID4
    source_type: str
    original_filename: Optional[str]
    source_url: Optional[str]
    mime_type: Optional[str]
    storage_path: Optional[str]
    checksum: Optional[str]
    content_preview: Optional[str]
    extra_metadata: Dict[str, Any]
    status: str
    error_message: Optional[str]
    created_by: Optional[UUID4]
    updated_by: Optional[UUID4]
    created_at: datetime
    updated_at: Optional[datetime]
    processing_started_at: Optional[datetime]
    processing_finished_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class KnowledgeDocumentTextCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: str = Field(..., min_length=1, max_length=200000)


class KnowledgeDocumentUrlCreate(BaseModel):
    url: HttpUrl
    description: Optional[str] = Field(default=None, max_length=4000)
