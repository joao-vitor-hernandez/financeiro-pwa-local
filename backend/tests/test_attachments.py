import uuid

import pytest

from app.services.storage_service import storage_service


def test_storage_service_validates_mime_types():
    """
    Fase 8.3: Apenas formatos de comprovantes seguros são aceitos (JPG, PNG, WebP e PDF).
    """
    tx_id = uuid.uuid4()

    # Rejeita executáveis e scripts maliciosos
    with pytest.raises(ValueError, match="Tipo de arquivo não permitido"):
        storage_service.save_file(
            file_bytes=b"echo dangerous",
            original_filename="script.sh",
            mime_type="application/x-sh",
            transaction_id=tx_id,
        )

    # Rejeita HTML ou arquivos desconhecidos
    with pytest.raises(ValueError, match="Tipo de arquivo não permitido"):
        storage_service.save_file(
            file_bytes=b"<html>bad</html>",
            original_filename="exploit.html",
            mime_type="text/html",
            transaction_id=tx_id,
        )


def test_storage_service_validates_max_file_size():
    """
    Fase 8.3: Arquivos que excedem 10 MB devem ser rejeitados para proteger a banda do homelab.
    """
    tx_id = uuid.uuid4()
    oversized = b"0" * (11 * 1024 * 1024)  # 11 MB

    with pytest.raises(ValueError, match="limite máximo permitido"):
        storage_service.save_file(
            file_bytes=oversized,
            original_filename="recibo_gigante.jpg",
            mime_type="image/jpeg",
            transaction_id=tx_id,
        )


def test_storage_service_local_save_get_and_delete():
    """
    Fase 8.3: Ciclo completo no disco local (fallback caso R2 não esteja configurado).
    """
    tx_id = uuid.uuid4()
    dummy_jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb"

    storage_key, provider = storage_service.save_file(
        file_bytes=dummy_jpg_bytes,
        original_filename="comprovante_pix.jpg",
        mime_type="image/jpeg",
        transaction_id=tx_id,
    )

    assert storage_key.startswith(f"tx_{tx_id}/")
    assert storage_key.endswith(".jpg")

    # Verifica existência física
    file_path = storage_service.get_local_file_path(storage_key)
    assert file_path.exists()
    assert file_path.read_bytes() == dummy_jpg_bytes

    # URL de visualização
    att_id = uuid.uuid4()
    url = storage_service.get_view_url(att_id, storage_key, provider)
    assert f"/api/v1/attachments/{att_id}/file" in url

    # Exclusão segura
    storage_service.delete_file(storage_key, provider)
    assert not file_path.exists()
