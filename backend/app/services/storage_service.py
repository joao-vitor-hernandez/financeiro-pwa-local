import uuid
from pathlib import Path

import boto3
from botocore.config import Config

from app.core.config import settings

ALLOWED_MIME_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class StorageService:
    """
    Serviço de Armazenamento de Comprovantes & Notas Fiscais (Fase 8.3 - Firefly III).
    Oferece integração com Cloudflare R2 (API S3 com zero taxa de tráfego de saída)
    e fallback automático para disco local se o R2 não estiver configurado.
    """

    def __init__(self) -> None:
        self.r2_enabled = bool(
            settings.R2_ACCOUNT_ID
            and settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
        )
        if self.r2_enabled:
            endpoint = (
                settings.R2_ENDPOINT_URL
                or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            )
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
                config=Config(signature_version="s3v4"),
            )
            self.bucket_name = (
                settings.R2_ATTACHMENTS_BUCKET_NAME or settings.R2_BUCKET_NAME or "financeiro-attachments"
            )
        else:
            self.s3_client = None
            self.bucket_name = None

        self.local_dir = Path(settings.LOCAL_STORAGE_DIR)
        self.local_dir.mkdir(parents=True, exist_ok=True)

    def save_file(
        self,
        file_bytes: bytes,
        original_filename: str,
        mime_type: str,
        transaction_id: uuid.UUID,
    ) -> tuple[str, str]:
        """
        Salva o arquivo no Cloudflare R2 ou no disco local.
        Retorna uma tupla (storage_key, provider).
        """
        clean_mime = mime_type.lower().split(";")[0].strip()
        if clean_mime not in ALLOWED_MIME_TYPES:
            raise ValueError(
                f"Tipo de arquivo não permitido: {clean_mime}. "
                "Formatos aceitos: JPG, PNG, WebP e PDF."
            )

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"O arquivo excede o limite máximo permitido de {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )

        ext = ALLOWED_MIME_TYPES.get(clean_mime, ".bin")
        file_uuid = uuid.uuid4().hex
        storage_key = f"tx_{transaction_id}/{file_uuid}{ext}"

        if self.r2_enabled and self.s3_client:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=storage_key,
                Body=file_bytes,
                ContentType=clean_mime,
            )
            return storage_key, "R2"
        else:
            target_path = self.local_dir / storage_key
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(file_bytes)
            return storage_key, "LOCAL"

    def get_view_url(self, attachment_id: uuid.UUID, storage_key: str, provider: str) -> str:
        """
        Gera uma URL pré-assinada de visualização (R2) ou endpoint interno de streaming (Local).
        """
        if provider == "R2" and self.r2_enabled and self.s3_client:
            try:
                url = self.s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": storage_key},
                    ExpiresIn=3600,
                )
                return url
            except Exception:
                # Fallback para endpoint interno em caso de falha de conexão com a AWS/R2
                return f"/api/v1/attachments/{attachment_id}/file"
        return f"/api/v1/attachments/{attachment_id}/file"

    def get_local_file_path(self, storage_key: str) -> Path:
        """
        Retorna o caminho seguro no disco local para download/streaming.
        """
        return self.local_dir / storage_key

    def delete_file(self, storage_key: str, provider: str) -> None:
        """
        Remove o arquivo físico do bucket R2 ou do disco local.
        """
        if provider == "R2" and self.r2_enabled and self.s3_client:
            try:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=storage_key)
            except Exception:
                pass
        else:
            local_path = self.local_dir / storage_key
            if local_path.exists():
                try:
                    local_path.unlink()
                except Exception:
                    pass


storage_service = StorageService()
