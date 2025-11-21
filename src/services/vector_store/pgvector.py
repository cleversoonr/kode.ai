"""
pgvector-backed implementation of the vector store contract.
"""

from __future__ import annotations

from typing import List, Sequence
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from src.models.models import KnowledgeChunk
from .base import BaseVectorStore, VectorChunkPayload, VectorSearchResult


class PgVectorStore(BaseVectorStore):
    """Persist embeddings inside the knowledge_chunks table using pgvector."""

    def upsert_chunks(
        self, db: Session, chunks: Sequence[VectorChunkPayload]
    ) -> None:
        if not chunks:
            return

        values = [
            {
                "id": chunk.chunk_id,
                "knowledge_base_id": chunk.knowledge_base_id,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "token_count": chunk.token_count,
                "content": chunk.content,
                "chunk_metadata": chunk.metadata,
                "embedding": chunk.embedding,
            }
            for chunk in chunks
        ]

        stmt = insert(KnowledgeChunk).values(values)
        update_columns = {
            "knowledge_base_id": stmt.excluded.knowledge_base_id,
            "document_id": stmt.excluded.document_id,
            "chunk_index": stmt.excluded.chunk_index,
            "token_count": stmt.excluded.token_count,
            "content": stmt.excluded.content,
            "chunk_metadata": stmt.excluded.chunk_metadata,
            "embedding": stmt.excluded.embedding,
        }
        db.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=update_columns))
        db.flush()

    def delete_chunks(self, db: Session, chunk_ids: Sequence[UUID]) -> None:
        if not chunk_ids:
            return

        (
            db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.id.in_(chunk_ids))
            .delete(synchronize_session=False)
        )
        db.flush()

    def similarity_search(
        self,
        db: Session,
        knowledge_base_ids: Sequence[UUID],
        query_embedding: Sequence[float],
        top_k: int = 5,
        score_threshold: float | None = None,
    ) -> Sequence[VectorSearchResult]:
        if not knowledge_base_ids:
            return []

        embedding_list: List[float] = [float(v) for v in query_embedding]

        distance_expr = KnowledgeChunk.embedding.cosine_distance(embedding_list)
        stmt = (
            sa.select(
                KnowledgeChunk.id,
                KnowledgeChunk.knowledge_base_id,
                KnowledgeChunk.document_id,
                KnowledgeChunk.content,
                KnowledgeChunk.chunk_metadata,
                KnowledgeChunk.chunk_index,
                KnowledgeChunk.token_count,
                distance_expr.label("distance"),
            )
            .where(KnowledgeChunk.knowledge_base_id.in_(knowledge_base_ids))
            .order_by(distance_expr.asc())
            .limit(top_k)
        )

        rows = db.execute(stmt).all()
        results: List[VectorSearchResult] = []
        for row in rows:
            distance = float(row.distance) if row.distance is not None else None
            if score_threshold is not None and distance is not None:
                if distance > score_threshold:
                    continue

            similarity = 1.0 - distance if distance is not None else 0.0
            results.append(
                VectorSearchResult(
                    chunk_id=row.id,
                    knowledge_base_id=row.knowledge_base_id,
                    document_id=row.document_id,
                    score=similarity,
                    content=row.content,
                    metadata=row.chunk_metadata or {},
                    chunk_index=row.chunk_index,
                    token_count=row.token_count,
                )
            )

        return results
