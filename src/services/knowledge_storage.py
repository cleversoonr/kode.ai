"""
Helper utilities to persist and organize raw knowledge documents on disk.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional
from uuid import UUID

from src.config.settings import settings


def _storage_root() -> Path:
    root = Path(settings.KNOWLEDGE_STORAGE_PATH)
    root.mkdir(parents=True, exist_ok=True)
    return root


def build_document_dir(client_id: UUID, base_id: UUID, document_id: UUID) -> Path:
    """
    Returns the directory path where a document's assets should be stored.
    """
    directory = _storage_root() / str(client_id) / str(base_id) / str(document_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def persist_uploaded_file(
    *,
    client_id: UUID,
    base_id: UUID,
    document_id: UUID,
    filename: str,
    data: bytes,
) -> str:
    """
    Saves the uploaded bytes to disk and returns the absolute path.
    """
    directory = build_document_dir(client_id, base_id, document_id)
    suffix = Path(filename).suffix or ".bin"
    target = directory / f"source{suffix}"
    target.write_bytes(data)
    return str(target)


def persist_text_content(
    *,
    client_id: UUID,
    base_id: UUID,
    document_id: UUID,
    content: str,
    extension: str = ".txt",
) -> str:
    """
    Stores plain text content in a file to keep a traceable artifact.
    """
    directory = build_document_dir(client_id, base_id, document_id)
    target = directory / f"text{extension}"
    target.write_text(content, encoding="utf-8")
    return str(target)
