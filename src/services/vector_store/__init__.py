from functools import lru_cache

from src.config.settings import settings

from .base import BaseVectorStore, VectorChunkPayload, VectorSearchResult
from .pgvector import PgVectorStore


@lru_cache()
def get_vector_store() -> BaseVectorStore:
    """Return the configured vector store implementation."""
    provider = settings.VECTOR_STORE_PROVIDER.lower()

    if provider == "pgvector":
        return PgVectorStore()

    raise ValueError(f"Unsupported VECTOR_STORE_PROVIDER: {settings.VECTOR_STORE_PROVIDER}")


__all__ = [
    "BaseVectorStore",
    "VectorChunkPayload",
    "VectorSearchResult",
    "get_vector_store",
]
