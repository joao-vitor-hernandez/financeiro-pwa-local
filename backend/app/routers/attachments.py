import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.transaction_attachment import TransactionAttachment
from app.schemas.attachment import AttachmentListResponse, AttachmentResponse
from app.services.storage_service import storage_service

router = APIRouter(tags=["Attachments"])


@router.post(
    "/transactions/{transaction_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Anexar Comprovante ou Nota Fiscal à Transação",
)
async def upload_attachment(
    transaction_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Realiza o upload de um comprovante (JPG, PNG, WebP ou PDF) vinculado a uma transação contábil.
    Salva no Cloudflare R2 ou no disco local e gera URL de visualização segura.
    """
    # 1. Verifica existência da transação
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    res = await db.execute(stmt)
    transaction = res.scalar_one_or_none()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {transaction_id} não encontrada.",
        )

    # 2. Leitura dos bytes do arquivo
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo enviado está vazio.",
        )

    mime_type = file.content_type or "application/octet-stream"
    original_name = file.filename or "comprovante"

    try:
        storage_key, provider = storage_service.save_file(
            file_bytes=file_bytes,
            original_filename=original_name,
            mime_type=mime_type,
            transaction_id=transaction_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 3. Persistência dos metadados no banco
    attachment = TransactionAttachment(
        transaction_id=transaction_id,
        file_name=original_name,
        file_size_bytes=len(file_bytes),
        mime_type=mime_type,
        storage_key=storage_key,
        storage_provider=provider,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    view_url = storage_service.get_view_url(attachment.id, storage_key, provider)

    return AttachmentResponse(
        id=attachment.id,
        transaction_id=attachment.transaction_id,
        file_name=attachment.file_name,
        file_size_bytes=attachment.file_size_bytes,
        mime_type=attachment.mime_type,
        view_url=view_url,
        created_at=attachment.created_at,
    )


@router.get(
    "/transactions/{transaction_id}/attachments",
    response_model=AttachmentListResponse,
    summary="Listar Comprovantes de uma Transação",
)
async def list_transaction_attachments(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna a lista de comprovantes e documentos vinculados a um lançamento financeiro específico.
    """
    stmt = (
        select(TransactionAttachment)
        .where(TransactionAttachment.transaction_id == transaction_id)
        .order_by(TransactionAttachment.created_at.desc())
    )
    res = await db.execute(stmt)
    attachments = res.scalars().all()

    items = [
        AttachmentResponse(
            id=att.id,
            transaction_id=att.transaction_id,
            file_name=att.file_name,
            file_size_bytes=att.file_size_bytes,
            mime_type=att.mime_type,
            view_url=storage_service.get_view_url(att.id, att.storage_key, att.storage_provider),
            created_at=att.created_at,
        )
        for att in attachments
    ]

    return AttachmentListResponse(attachments=items, total_count=len(items))


@router.get(
    "/attachments/{attachment_id}/file",
    summary="Download ou Visualização do Arquivo do Comprovante",
)
async def get_attachment_file(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Entrega o binário do arquivo para visualização inline ou redireciona para URL pré-assinada do Cloudflare R2.
    """
    stmt = select(TransactionAttachment).where(TransactionAttachment.id == attachment_id)
    res = await db.execute(stmt)
    attachment = res.scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comprovante não encontrado.",
        )

    if attachment.storage_provider == "R2" and storage_service.r2_enabled:
        url = storage_service.get_view_url(
            attachment.id, attachment.storage_key, attachment.storage_provider
        )
        if url.startswith("http"):
            return RedirectResponse(url=url)

    # Fallback local
    local_path = storage_service.get_local_file_path(attachment.storage_key)
    if not local_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo físico não encontrado no armazenamento local.",
        )

    return FileResponse(
        path=local_path,
        media_type=attachment.mime_type,
        filename=attachment.file_name,
    )


@router.delete(
    "/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir Comprovante",
)
async def delete_attachment(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Exclui o registro do comprovante e apaga o arquivo físico correspondente do bucket R2 ou disco.
    """
    stmt = select(TransactionAttachment).where(TransactionAttachment.id == attachment_id)
    res = await db.execute(stmt)
    attachment = res.scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comprovante não encontrado.",
        )

    # 1. Deleta arquivo físico
    storage_service.delete_file(attachment.storage_key, attachment.storage_provider)

    # 2. Deleta registro no banco
    await db.delete(attachment)
    await db.commit()
