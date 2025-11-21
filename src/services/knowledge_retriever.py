"""
Utilities to retrieve RAG context for agents configured with knowledge bases.
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from src.services.vector_store import get_vector_store
from src.services.embedding_service import generate_embeddings
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

DEFAULT_TOP_K = 5
DEFAULT_SCORE_THRESHOLD = 0.35


class KnowledgeRetriever:
    """Fetches relevant chunks from configured knowledge bases."""

    def __init__(self, db: Session):
        self.db = db
        self.vector_store = get_vector_store()

    def apply_context(self, agent, query: str) -> Optional[Dict[str, Any]]:
        """
        Generates context for the provided agent and user query.

        Returns a payload with the context text and references or None if no
        bases are configured.
        """
        config = self._get_agent_config(agent)
        base_ids = config.get("knowledge_base_ids") or []

        if not base_ids or not query or not query.strip():
            return None

        base_uuids = self._normalize_base_ids(base_ids)
        if not base_uuids:
            logger.warning("Agent %s has invalid knowledge_base_ids", agent.id)
            return None

        embeddings = generate_embeddings([query])
        if not embeddings:
            logger.warning("Could not generate embeddings for query")
            return None

        top_k = int(config.get("rag_top_k", DEFAULT_TOP_K))
        score_threshold = config.get("rag_score_threshold", DEFAULT_SCORE_THRESHOLD)
        try:
            score_threshold = float(score_threshold)
        except (TypeError, ValueError):
            score_threshold = DEFAULT_SCORE_THRESHOLD

        results = self.vector_store.similarity_search(
            self.db,
            base_uuids,
            embeddings[0],
            top_k=top_k,
            score_threshold=score_threshold,
        )

        if not results:
            logger.info(
                "No knowledge chunks found for agent %s with query '%s'",
                agent.id,
                query,
            )
            return None

        context_sections: List[str] = []
        references: List[Dict[str, Any]] = []

        for idx, chunk in enumerate(results, start=1):
            snippet = chunk.content.strip()
            metadata = chunk.metadata or {}
            source_label = (
                metadata.get("source_url")
                or metadata.get("original_filename")
                or metadata.get("document_id")
                or "knowledge-base"
            )

            context_sections.append(
                f"[{idx}] {snippet}\nSource: {source_label}".strip()
            )
            references.append(
                {
                    "document_id": metadata.get("document_id"),
                    "knowledge_base_id": metadata.get("knowledge_base_id"),
                    "source": source_label,
                    "chunk_index": chunk.chunk_index,
                    "score": chunk.score,
                    "metadata": metadata,
                }
            )

        context_text = "\n\n".join(context_sections)
        runtime_config = copy.deepcopy(config)
        runtime_config["__rag_context__"] = {
            "text": context_text,
            "references": references,
        }

        setattr(agent, "runtime_config", runtime_config)
        return runtime_config["__rag_context__"]

    def _normalize_base_ids(self, base_ids: List[Any]) -> List[UUID]:
        normalized: List[UUID] = []
        for base_id in base_ids:
            try:
                normalized.append(UUID(str(base_id)))
            except (TypeError, ValueError):
                continue
        return normalized

    def _get_agent_config(self, agent) -> Dict[str, Any]:
        if hasattr(agent, "runtime_config") and agent.runtime_config:
            return agent.runtime_config
        return agent.config or {}
