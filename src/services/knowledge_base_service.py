"""
Service helpers for the Knowledge Base module.

The functions defined here encapsulate the persistence logic so that future
API or background workers can share the same rules for creating bases,
documents and vector chunks.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence
from uuid import UUID, uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.models.models import (
    KnowledgeBase,
    KnowledgeDocument,
    KnowledgeJob,
    KnowledgeChunk,
)
from src.services.vector_store import (
    VectorChunkPayload,
    get_vector_store,
)

VALID_SOURCE_TYPES = {"upload", "url", "text"}
VALID_JOB_TYPES = {"ingest", "reprocess"}


def create_knowledge_base(
    db: Session,
    *,
    client_id: UUID,
    name: str,
    description: Optional[str] = None,
    language: Optional[str] = None,
    embedding_model: Optional[str] = None,
    created_by: Optional[UUID] = None,
    chunk_size: int = 512,
    chunk_overlap: int = 128,
    config: Optional[Dict[str, Any]] = None,
) -> KnowledgeBase:
    base = KnowledgeBase(
        client_id=client_id,
        name=name,
        description=description,
        language=language,
        embedding_model=embedding_model,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        created_by=created_by,
        config=config or {},
    )
    db.add(base)
    db.commit()
    db.refresh(base)
    return base


def list_knowledge_bases(
    db: Session,
    *,
    client_id: UUID,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[KnowledgeBase]:
    query = (
        db.query(KnowledgeBase)
        .filter(
            KnowledgeBase.client_id == client_id,
            KnowledgeBase.is_active.is_(True),
        )
        .order_by(KnowledgeBase.created_at.desc())
    )

    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.filter(func.lower(KnowledgeBase.name).like(search_pattern))

    return query.offset(skip).limit(limit).all()


def get_knowledge_base(
    db: Session, *, base_id: UUID, client_id: Optional[UUID] = None
) -> Optional[KnowledgeBase]:
    query = db.query(KnowledgeBase).filter(KnowledgeBase.id == base_id)
    if client_id:
        query = query.filter(KnowledgeBase.client_id == client_id)
    return query.first()


def update_knowledge_base(
    db: Session,
    *,
    base: KnowledgeBase,
    name: Optional[str] = None,
    description: Optional[str] = None,
    language: Optional[str] = None,
    embedding_model: Optional[str] = None,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
    config: Optional[Dict[str, Any]] = None,
    updated_by: Optional[UUID] = None,
) -> KnowledgeBase:
    if name is not None:
        base.name = name
    if description is not None:
        base.description = description
    if language is not None:
        base.language = language
    if embedding_model is not None:
        base.embedding_model = embedding_model
    if chunk_size is not None:
        base.chunk_size = chunk_size
    if chunk_overlap is not None:
        base.chunk_overlap = chunk_overlap
    if config is not None:
        base.config = config
    if updated_by:
        base.updated_by = updated_by

    db.add(base)
    db.commit()
    db.refresh(base)
    return base


def archive_knowledge_base(db: Session, *, base: KnowledgeBase) -> KnowledgeBase:
    base.is_active = False
    db.add(base)
    db.commit()
    db.refresh(base)
    return base


def create_document(
    db: Session,
    *,
    knowledge_base_id: UUID,
    client_id: UUID,
    source_type: str,
    created_by: Optional[UUID],
    original_filename: Optional[str] = None,
    source_url: Optional[str] = None,
    mime_type: Optional[str] = None,
    storage_path: Optional[str] = None,
    checksum: Optional[str] = None,
    content_preview: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> KnowledgeDocument:
    if source_type not in VALID_SOURCE_TYPES:
        raise ValueError(f"Invalid source type: {source_type}")

    document = KnowledgeDocument(
        knowledge_base_id=knowledge_base_id,
        client_id=client_id,
        source_type=source_type,
        original_filename=original_filename,
        source_url=source_url,
        mime_type=mime_type,
        storage_path=storage_path,
        checksum=checksum,
        content_preview=content_preview,
        extra_metadata=metadata or {},
        created_by=created_by,
    )

    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def update_document_status(
    db: Session,
    *,
    document: KnowledgeDocument,
    status: str,
    error_message: Optional[str] = None,
) -> KnowledgeDocument:
    valid_status = {"pending", "processing", "ready", "error"}
    if status not in valid_status:
        raise ValueError(f"Invalid document status {status}")

    document.status = status
    document.error_message = error_message

    current_time = datetime.now(timezone.utc)
    if status == "processing":
        document.processing_started_at = current_time
    elif status in {"ready", "error"}:
        document.processing_finished_at = current_time

    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def list_documents(
    db: Session,
    *,
    knowledge_base_id: UUID,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[KnowledgeDocument]:
    query = (
        db.query(KnowledgeDocument)
        .filter(KnowledgeDocument.knowledge_base_id == knowledge_base_id)
        .order_by(KnowledgeDocument.created_at.desc())
    )

    if status:
        query = query.filter(KnowledgeDocument.status == status)

    return query.offset(skip).limit(limit).all()


def get_document(
    db: Session, *, document_id: UUID, client_id: Optional[UUID] = None
) -> Optional[KnowledgeDocument]:
    query = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == document_id)
    if client_id:
        query = query.filter(KnowledgeDocument.client_id == client_id)
    return query.first()


def create_job(
    db: Session,
    *,
    document_id: UUID,
    job_type: str = "ingest",
) -> KnowledgeJob:
    if job_type not in VALID_JOB_TYPES:
        raise ValueError(f"Invalid job type: {job_type}")

    job = KnowledgeJob(
        document_id=document_id,
        job_type=job_type,
        status="queued",
        attempts=0,
        logs=[],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, *, job_id: UUID) -> Optional[KnowledgeJob]:
    return db.query(KnowledgeJob).filter(KnowledgeJob.id == job_id).first()


def update_job_status(
    db: Session,
    *,
    job: KnowledgeJob,
    status: str,
    error_message: Optional[str] = None,
    log_message: Optional[str] = None,
) -> KnowledgeJob:
    valid_status = {"queued", "processing", "completed", "failed"}
    if status not in valid_status:
        raise ValueError(f"Invalid job status {status}")

    job.status = status
    if status == "processing":
        job.started_at = datetime.now(timezone.utc)
        job.attempts = (job.attempts or 0) + 1
    elif status in {"completed", "failed"}:
        job.finished_at = datetime.now(timezone.utc)

    if error_message:
        job.error_message = error_message

    if log_message:
        logs = job.logs or []
        logs.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": log_message,
                "status": status,
            }
        )
        job.logs = logs

    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def delete_chunks_for_document(db: Session, *, document_id: UUID) -> None:
    chunk_ids = [
        row[0]
        for row in db.query(KnowledgeChunk.id).filter(
            KnowledgeChunk.document_id == document_id
        )
    ]
    if not chunk_ids:
        return

    store = get_vector_store()
    store.delete_chunks(db, chunk_ids)
    db.commit()


def save_document_chunks(
    db: Session,
    *,
    knowledge_base_id: UUID,
    document_id: UUID,
    chunks: Sequence[Dict[str, Any]],
) -> List[UUID]:
    """Persist document chunks and embeddings via the configured vector store."""
    store = get_vector_store()
    payloads: List[VectorChunkPayload] = []

    for idx, chunk in enumerate(chunks):
        if "embedding" not in chunk:
            raise ValueError("Chunk payload must include 'embedding'")
        if "content" not in chunk:
            raise ValueError("Chunk payload must include 'content'")

        chunk_id = chunk.get("id", uuid4())
        payloads.append(
            VectorChunkPayload(
                chunk_id=chunk_id,
                knowledge_base_id=knowledge_base_id,
                document_id=document_id,
                chunk_index=chunk.get("chunk_index", idx),
                token_count=chunk.get("token_count", 0),
                content=chunk["content"],
                metadata=chunk.get("metadata", {}),
                embedding=[float(value) for value in chunk["embedding"]],
            )
        )

    store.upsert_chunks(db, payloads)
    db.commit()
    return [payload.chunk_id for payload in payloads]


def delete_document_chunks(db: Session, *, chunk_ids: Sequence[UUID]) -> None:
    store = get_vector_store()
    store.delete_chunks(db, chunk_ids)
    db.commit()
