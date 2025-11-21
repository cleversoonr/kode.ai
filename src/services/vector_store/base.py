"""
Core abstractions for interacting with the vector store backing the knowledge
base module. Keeping the API small makes it easier to plug in alternative
providers (pgvector, Pinecone, etc.) without touching business logic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Sequence, List
from uuid import UUID

from sqlalchemy.orm import Session


@dataclass(slots=True)
class VectorChunkPayload:
    chunk_id: UUID
    knowledge_base_id: UUID
    document_id: UUID
    chunk_index: int
    token_count: int
    content: str
    metadata: Dict[str, Any]
    embedding: List[float]


@dataclass(slots=True)
class VectorSearchResult:
    chunk_id: UUID
    knowledge_base_id: UUID
    document_id: UUID
    score: float
    content: str
    metadata: Dict[str, Any]
    chunk_index: int
    token_count: int


class BaseVectorStore(ABC):
    """Contract that every vector store implementation must follow."""

    @abstractmethod
    def upsert_chunks(
        self, db: Session, chunks: Sequence[VectorChunkPayload]
    ) -> None:
        """Insert or update chunk embeddings and metadata."""

    @abstractmethod
    def delete_chunks(self, db: Session, chunk_ids: Sequence[UUID]) -> None:
        """Remove existing chunks from the store."""

    @abstractmethod
    def similarity_search(
        self,
        db: Session,
        knowledge_base_ids: Sequence[UUID],
        query_embedding: Sequence[float],
        top_k: int = 5,
        score_threshold: float | None = None,
    ) -> Sequence[VectorSearchResult]:
        """
        Retrieve the most relevant chunks for a given embedding.

        Args:
            knowledge_base_ids: Bases to search.
            query_embedding: Embedding generated from the user query.
            top_k: Maximum items to return.
            score_threshold: Optional maximum cosine distance to accept.
        """
