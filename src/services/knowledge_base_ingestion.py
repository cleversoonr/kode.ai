"""
Background ingestion pipeline for knowledge documents.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Sequence
from uuid import UUID

import httpx
from bs4 import BeautifulSoup
from docx import Document as DocxDocument
from pypdf import PdfReader

from src.config.database import SessionLocal
from src.config.settings import settings
from src.services import knowledge_base_service
from src.services.embedding_service import generate_embeddings
from src.services.knowledge_storage import persist_text_content
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


def process_document_ingestion(document_id: UUID | str, job_id: UUID | str | None = None) -> None:
    """
    Entry point executed asynchronously to ingest a document.
    """
    document_uuid = UUID(str(document_id))
    job_uuid = UUID(str(job_id)) if job_id else None

    db = SessionLocal()
    job = None
    try:
        if job_uuid:
            job = knowledge_base_service.get_job(db, job_id=job_uuid)
            if job:
                knowledge_base_service.update_job_status(
                    db,
                    job=job,
                    status="processing",
                    log_message="Started ingestion",
                )

        document = knowledge_base_service.get_document(db, document_id=document_uuid)
        if not document:
            raise ValueError("Document not found")

        base = document.knowledge_base
        knowledge_base_service.update_document_status(db, document=document, status="processing")

        raw_text = _extract_document_text(document)
        if not raw_text or not raw_text.strip():
            raise ValueError("Document content is empty")

        chunk_size = base.chunk_size or settings.MAX_CHUNK_TOKENS
        chunk_overlap = base.chunk_overlap or settings.CHUNK_OVERLAP

        chunks = _chunk_text(raw_text, chunk_size, chunk_overlap)
        if not chunks:
            raise ValueError("Unable to generate chunks from document")

        embeddings = generate_embeddings(chunks)
        if len(embeddings) != len(chunks):
            raise ValueError("Embedding generation mismatch")

        knowledge_base_service.delete_chunks_for_document(db, document_id=document.id)

        payloads = []
        for idx, (chunk_text, vector) in enumerate(zip(chunks, embeddings)):
            payloads.append(
                {
                    "chunk_index": idx,
                    "token_count": len(chunk_text.split()),
                    "content": chunk_text,
                    "metadata": _build_chunk_metadata(document, idx),
                    "embedding": vector,
                }
            )

        knowledge_base_service.save_document_chunks(
            db,
            knowledge_base_id=document.knowledge_base_id,
            document_id=document.id,
            chunks=payloads,
        )

        metadata = document.extra_metadata or {}
        metadata["last_processed_at"] = datetime.now(timezone.utc).isoformat()
        document.extra_metadata = metadata
        db.add(document)
        db.commit()
        db.refresh(document)

        knowledge_base_service.update_document_status(db, document=document, status="ready")
        if job:
            knowledge_base_service.update_job_status(
                db,
                job=job,
                status="completed",
                log_message="Ingestion completed",
            )
    except Exception as exc:
        logger.exception("Error ingesting document %s", document_id)
        try:
            document = knowledge_base_service.get_document(db, document_id=document_uuid)
            if document:
                knowledge_base_service.update_document_status(
                    db, document=document, status="error", error_message=str(exc)
                )
        except Exception:
            logger.exception("Unable to update document status for %s", document_id)
        if job:
            try:
                knowledge_base_service.update_job_status(
                    db,
                    job=job,
                    status="failed",
                    error_message=str(exc),
                    log_message="Ingestion failed",
                )
            except Exception:
                logger.exception("Unable to update job status for %s", job_id)
    finally:
        db.close()


def _extract_document_text(document) -> str:
    source_type = document.source_type
    if source_type == "upload":
        if not document.storage_path:
            raise ValueError("Upload does not have a storage path")
        return _extract_from_file(Path(document.storage_path), document.mime_type or "")

    if source_type == "text":
        metadata = document.extra_metadata or {}
        return metadata.get("raw_text", "")

    if source_type == "url":
        if not document.source_url:
            raise ValueError("Document is missing source_url")
        content = _fetch_url(document.source_url)
        persist_text_content(
            client_id=document.client_id,
            base_id=document.knowledge_base_id,
            document_id=document.id,
            content=content,
            extension=".url.txt",
        )
        metadata = document.extra_metadata or {}
        metadata["last_fetched_at"] = datetime.now(timezone.utc).isoformat()
        document.extra_metadata = metadata
        return content

    raise ValueError(f"Unsupported source type {source_type}")


def _extract_from_file(path: Path, mime_type: str) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf" or "pdf" in mime_type:
        reader = PdfReader(str(path))
        texts = []
        for page in reader.pages:
            try:
                texts.append(page.extract_text() or "")
            except Exception:  # pragma: no cover - extraction best effort
                continue
        return "\n".join(texts)

    if suffix == ".docx" or "wordprocessingml" in mime_type:
        doc = DocxDocument(str(path))
        return "\n".join(paragraph.text for paragraph in doc.paragraphs)

    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1", errors="ignore")


def _fetch_url(url: str) -> str:
    with httpx.Client(timeout=20) as client:
        response = client.get(url)
        response.raise_for_status()
        html = response.text

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    return text


def _chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    words = text.split()
    if not words:
        return []

    normalized_chunk = max(chunk_size, 64)
    normalized_overlap = max(0, min(overlap, normalized_chunk // 2))

    chunks = []
    start = 0
    total_words = len(words)

    while start < total_words:
        end = min(start + normalized_chunk, total_words)
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words).strip()
        if chunk_text:
            chunks.append(chunk_text)
        if end == total_words:
            break
        start = max(end - normalized_overlap, 0)

    return chunks


def _build_chunk_metadata(document, chunk_index: int) -> dict:
    metadata = {
        "source_type": document.source_type,
        "document_id": str(document.id),
        "knowledge_base_id": str(document.knowledge_base_id),
        "chunk_index": chunk_index,
    }
    if document.original_filename:
        metadata["original_filename"] = document.original_filename
    if document.source_url:
        metadata["source_url"] = document.source_url
    return metadata
