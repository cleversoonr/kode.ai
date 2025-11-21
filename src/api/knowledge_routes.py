"""
Knowledge base CRUD endpoints.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Set

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
    Form,
    status,
)
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.config.settings import settings
from src.core.jwt_middleware import get_jwt_token, verify_user_client
from src.schemas.knowledge_base import (
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
    KnowledgeDocumentResponse,
    KnowledgeDocumentTextCreate,
    KnowledgeDocumentUrlCreate,
)
from src.services import knowledge_base_service
from src.services.knowledge_base_ingestion import process_document_ingestion
from src.services.knowledge_storage import persist_text_content, persist_uploaded_file

router = APIRouter(
    prefix="/knowledge-bases",
    tags=["knowledge-bases"],
    responses={404: {"description": "Not found"}},
)


def _get_user_uuid(payload: dict) -> Optional[uuid.UUID]:
    """Extracts the user ID from the JWT payload, if present."""
    sub = payload.get("sub")
    try:
        return uuid.UUID(str(sub))
    except (TypeError, ValueError):
        return None


def _schedule_ingestion(background_tasks: BackgroundTasks, document_id: uuid.UUID, job_id: uuid.UUID) -> None:
    background_tasks.add_task(
        process_document_ingestion,
        str(document_id),
        str(job_id),
    )


def _allowed_mime_types() -> Set[str]:
    return {mime.strip() for mime in settings.KNOWLEDGE_ALLOWED_MIME_TYPES if mime.strip()}


@router.post(
    "/",
    response_model=KnowledgeBaseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_knowledge_base(
    data: KnowledgeBaseCreate,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    user_id = _get_user_uuid(payload)

    knowledge_base = knowledge_base_service.create_knowledge_base(
        db,
        client_id=x_client_id,
        name=data.name,
        description=data.description,
        language=data.language,
        embedding_model=data.embedding_model,
        created_by=user_id,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
        config=data.config,
    )

    return knowledge_base


@router.get("/", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    return knowledge_base_service.list_knowledge_bases(
        db,
        client_id=x_client_id,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    knowledge_base_id: uuid.UUID,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)

    base = knowledge_base_service.get_knowledge_base(
        db, base_id=knowledge_base_id, client_id=x_client_id
    )
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return base


@router.patch("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base_endpoint(
    knowledge_base_id: uuid.UUID,
    data: KnowledgeBaseUpdate,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    base = knowledge_base_service.get_knowledge_base(
        db, base_id=knowledge_base_id, client_id=x_client_id
    )
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    updated_base = knowledge_base_service.update_knowledge_base(
        db,
        base=base,
        name=data.name,
        description=data.description,
        language=data.language,
        embedding_model=data.embedding_model,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
        config=data.config,
        updated_by=_get_user_uuid(payload),
    )
    return updated_base


@router.delete(
    "/{knowledge_base_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_knowledge_base(
    knowledge_base_id: uuid.UUID,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    base = knowledge_base_service.get_knowledge_base(
        db, base_id=knowledge_base_id, client_id=x_client_id
    )
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    knowledge_base_service.archive_knowledge_base(db, base=base)


@router.post(
    "/{knowledge_base_id}/documents/upload",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    knowledge_base_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: Optional[str] = Form(default=None, max_length=4000),
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    base = knowledge_base_service.get_knowledge_base(db, base_id=knowledge_base_id, client_id=x_client_id)
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit",
        )

    mime_type = file.content_type or "application/octet-stream"
    allowed = _allowed_mime_types()
    if allowed and mime_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MIME type {mime_type} is not allowed",
        )

    metadata = {}
    if description:
        metadata["description"] = description

    document = knowledge_base_service.create_document(
        db,
        knowledge_base_id=knowledge_base_id,
        client_id=x_client_id,
        source_type="upload",
        created_by=_get_user_uuid(payload),
        original_filename=file.filename or "document",
        mime_type=mime_type,
        content_preview=description,
        metadata=metadata,
    )

    storage_path = persist_uploaded_file(
        client_id=x_client_id,
        base_id=knowledge_base_id,
        document_id=document.id,
        filename=file.filename or f"{document.id}",
        data=contents,
    )

    document.storage_path = storage_path
    document.mime_type = mime_type
    document.extra_metadata = {**(document.extra_metadata or {}), **metadata}
    db.add(document)
    db.commit()
    db.refresh(document)

    job = knowledge_base_service.create_job(db, document_id=document.id, job_type="ingest")
    _schedule_ingestion(background_tasks, document.id, job.id)

    return document


@router.post(
    "/{knowledge_base_id}/documents/text",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_text_document(
    knowledge_base_id: uuid.UUID,
    data: KnowledgeDocumentTextCreate,
    background_tasks: BackgroundTasks,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)

    base = knowledge_base_service.get_knowledge_base(db, base_id=knowledge_base_id, client_id=x_client_id)
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    metadata = {"raw_text": data.content}
    if data.title:
        metadata["title"] = data.title

    preview = data.content[:4000]
    document = knowledge_base_service.create_document(
        db,
        knowledge_base_id=knowledge_base_id,
        client_id=x_client_id,
        source_type="text",
        created_by=_get_user_uuid(payload),
        content_preview=preview,
        metadata=metadata,
        mime_type="text/plain",
    )

    storage_path = persist_text_content(
        client_id=x_client_id,
        base_id=knowledge_base_id,
        document_id=document.id,
        content=data.content,
        extension=".txt",
    )
    document.storage_path = storage_path
    db.add(document)
    db.commit()
    db.refresh(document)

    job = knowledge_base_service.create_job(db, document_id=document.id, job_type="ingest")
    _schedule_ingestion(background_tasks, document.id, job.id)

    return document


@router.post(
    "/{knowledge_base_id}/documents/url",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_url_document(
    knowledge_base_id: uuid.UUID,
    data: KnowledgeDocumentUrlCreate,
    background_tasks: BackgroundTasks,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    base = knowledge_base_service.get_knowledge_base(db, base_id=knowledge_base_id, client_id=x_client_id)
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    metadata = {}
    if data.description:
        metadata["description"] = data.description

    document = knowledge_base_service.create_document(
        db,
        knowledge_base_id=knowledge_base_id,
        client_id=x_client_id,
        source_type="url",
        created_by=_get_user_uuid(payload),
        source_url=str(data.url),
        content_preview=data.description,
        metadata=metadata,
        mime_type="text/html",
    )

    persist_text_content(
        client_id=x_client_id,
        base_id=knowledge_base_id,
        document_id=document.id,
        content=f"URL: {data.url}\nDescription: {data.description or ''}",
        extension=".meta.txt",
    )

    db.refresh(document)
    job = knowledge_base_service.create_job(db, document_id=document.id, job_type="ingest")
    _schedule_ingestion(background_tasks, document.id, job.id)

    return document


@router.get(
    "/{knowledge_base_id}/documents",
    response_model=List[KnowledgeDocumentResponse],
)
async def list_documents(
    knowledge_base_id: uuid.UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)

    base = knowledge_base_service.get_knowledge_base(
        db, base_id=knowledge_base_id, client_id=x_client_id
    )
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    return knowledge_base_service.list_documents(
        db,
        knowledge_base_id=knowledge_base_id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/documents/{document_id}",
    response_model=KnowledgeDocumentResponse,
)
async def get_document(
    document_id: uuid.UUID,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    document = knowledge_base_service.get_document(
        db, document_id=document_id, client_id=x_client_id
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge document not found")

    return document


@router.post(
    "/documents/{document_id}/reprocess",
    response_model=KnowledgeDocumentResponse,
)
async def reprocess_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    x_client_id: uuid.UUID = Header(..., alias="x-client-id"),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_jwt_token),
):
    await verify_user_client(payload, db, x_client_id)
    document = knowledge_base_service.get_document(db, document_id=document_id, client_id=x_client_id)
    if not document or document.client_id != x_client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge document not found")

    knowledge_base_service.update_document_status(db, document=document, status="pending", error_message=None)
    job = knowledge_base_service.create_job(db, document_id=document.id, job_type="reprocess")
    _schedule_ingestion(background_tasks, document.id, job.id)
    return document
