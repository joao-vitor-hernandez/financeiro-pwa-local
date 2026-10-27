#!/usr/bin/env bash
# ==============================================================================
# backup-r2.sh - Script de Backup Criptografado do PostgreSQL para Cloudflare R2
# Utilizado no Homelab / Linux
# ==============================================================================

set -euo pipefail

# Carregar variáveis do .env se existir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="${PROJECT_ROOT}/backups"
RAW_FILE="${BACKUP_DIR}/dump_${TIMESTAMP}.sql.gz"
ENC_FILE="${BACKUP_DIR}/dump_${TIMESTAMP}.sql.gz.age"

mkdir -p "$BACKUP_DIR"

echo "=== [1/4] Gerando dump comprimido do PostgreSQL ==="
# Executa pg_dump dentro do container Docker
docker exec -t financeiro_postgres pg_dump -U "${POSTGRES_USER:-postgres_user}" -d "${POSTGRES_DB:-financeiro_db}" | gzip > "$RAW_FILE"

echo "=== [2/4] Criptografando com 'age' (Chave Pública) ==="
# age criptografa o arquivo com a chave pública.
# NENHUMA pessoa sem a chave privada offline poderá ler este arquivo.
if [ -z "${AGE_PUBLIC_KEY:-}" ]; then
    echo "ERRO: AGE_PUBLIC_KEY não está configurada no .env!"
    rm -f "$RAW_FILE"
    exit 1
fi

age -r "$AGE_PUBLIC_KEY" -o "$ENC_FILE" "$RAW_FILE"
# Remover o arquivo descriptografado imediatamente após a criptografia
rm -f "$RAW_FILE"

echo "=== [3/4] Enviando backup cifrado para Cloudflare R2 ==="
# Utiliza rclone configurado com o bucket R2
if command -v rclone &> /dev/null; then
    rclone copy "$ENC_FILE" "r2:${R2_BUCKET_NAME:-financeiro-backups}/postgres/"
    echo "Upload para Cloudflare R2 concluído com sucesso."
else
    echo "AVISO: 'rclone' não encontrado no PATH. Arquivo cifrado mantido localmente em: $ENC_FILE"
fi

echo "=== [4/4] Limpeza de backups locais antigos (> 7 dias) ==="
find "$BACKUP_DIR" -type f -name "*.age" -mtime +7 -delete

echo "Backup concluído com segurança: $ENC_FILE"
