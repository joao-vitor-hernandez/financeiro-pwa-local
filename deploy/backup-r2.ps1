# ==============================================================================
# backup-r2.ps1 - Script de Backup Criptografado do PostgreSQL para Cloudflare R2
# Utilizado no Windows (PowerShell)
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot ".env"

# Carregar variáveis do .env se existir
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match '^([^#=]+)=(.*)$' } | ForEach-Object {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
$BackupDir = Join-Path $ProjectRoot "backups"
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$RawFile = Join-Path $BackupDir "dump_$Timestamp.sql"
$EncFile = Join-Path $BackupDir "dump_$Timestamp.sql.age"

$PostgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres_user" }
$PostgresDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "financeiro_db" }
$AgePublicKey = $env:AGE_PUBLIC_KEY

Write-Host "=== [1/3] Gerando dump do PostgreSQL via Docker ===" -ForegroundColor Cyan
& docker exec -t financeiro_postgres pg_dump -U $PostgresUser -d $PostgresDb > $RawFile

if (-not (Test-Path $RawFile) -or (Get-Item $RawFile).Length -eq 0) {
    Write-Error "Falha ao gerar o dump do banco de dados."
}

Write-Host "=== [2/3] Criptografando com 'age' (Chave Pública) ===" -ForegroundColor Cyan
if ([string]::IsNullOrWhiteSpace($AgePublicKey)) {
    Write-Warning "AGE_PUBLIC_KEY não está configurada no .env! O arquivo dump foi mantido descriptografado em: $RawFile"
    exit 0
}

& age -r $AgePublicKey -o $EncFile $RawFile
# Remover o arquivo não criptografado imediatamente
Remove-Item $RawFile -Force
Write-Host "Arquivo criptografado com sucesso: $EncFile" -ForegroundColor Green

Write-Host "=== [3/3] Upload para Cloudflare R2 ===" -ForegroundColor Cyan
if (Get-Command rclone -ErrorAction SilentlyContinue) {
    $Bucket = if ($env:R2_BUCKET_NAME) { $env:R2_BUCKET_NAME } else { "financeiro-backups" }
    & rclone copy $EncFile "r2:$Bucket/postgres/"
    Write-Host "Upload para Cloudflare R2 concluído com sucesso." -ForegroundColor Green
} else {
    Write-Host "Aviso: 'rclone' não está configurado. O arquivo cifrado foi mantido localmente em: $EncFile" -ForegroundColor Yellow
}
