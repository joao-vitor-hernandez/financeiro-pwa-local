-- ==============================================================================
-- init-db.sql - Inicialização do Banco de Dados PostgreSQL 16
-- Executado automaticamente pelo container na primeira inicialização
-- ==============================================================================

-- Configurar codificação e timezone padrão
SET client_encoding = 'UTF8';
SET timezone = 'UTC';

-- Habilitar extensões úteis para criptografia e identificadores
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Log de confirmação de inicialização
DO $$
BEGIN
    RAISE NOTICE 'Banco de dados inicializado com sucesso com suporte a UUID e pgcrypto em UTC.';
END $$;
