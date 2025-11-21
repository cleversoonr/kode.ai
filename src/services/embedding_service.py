"""
Lightweight wrapper around LiteLLM to generate embeddings for RAG chunks.
"""

from __future__ import annotations

from typing import Iterable, List

from litellm import embedding

from src.config.settings import settings
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


def generate_embeddings(texts: Iterable[str]) -> List[List[float]]:
    """
    Generate embeddings for a collection of text chunks.

    Args:
        texts: Iterable with the chunk strings.
    Returns:
        List of embedding vectors.
    """
    text_list = [text for text in texts if text and text.strip()]
    if not text_list:
        return []

    api_key = settings.EMBEDDING_API_KEY
    if not api_key:
    logger.error("EMBEDDING_API_KEY is not configured")
    raise ValueError("Embedding API key not configured")

    kwargs = {}
    if settings.EMBEDDING_BASE_URL:
        kwargs["base_url"] = settings.EMBEDDING_BASE_URL

    response = embedding(
        model=settings.EMBEDDING_MODEL,
        input=text_list,
        api_key=api_key,
        **kwargs,
    )

    data = response.get("data", [])
    if len(data) != len(text_list):
        logger.warning("Embedding API returned mismatch: %s vs %s", len(data), len(text_list))

    embeddings = []
    for item in data:
        vector = item.get("embedding")
        if not vector:
            continue
        embeddings.append(vector)

    return embeddings
