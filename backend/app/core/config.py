from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Caminho para o arquivo .env na raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """
    Configurações centralizadas da aplicação carregadas via variáveis de ambiente (.env).
    """

    ENVIRONMENT: str = "development"
    APP_NAME: str = "ClariFin"
    DEBUG: bool = True

    # PostgreSQL
    POSTGRES_USER: str = "postgres_user"
    POSTGRES_PASSWORD: str = "postgres_password_dev_123"
    POSTGRES_DB: str = "financeiro_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str | None = None

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
                f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        if self.ENVIRONMENT == "production":
            if "dev_secret_key" in self.JWT_SECRET_KEY or len(self.JWT_SECRET_KEY) < 32:
                raise ValueError(
                    "VIOLAÇÃO CRÍTICA DE SEGURANÇA: Em ambiente de produção (ENVIRONMENT='production'), "
                    "a JWT_SECRET_KEY deve ser uma chave forte exclusiva (mínimo 32 caracteres) "
                    "e não pode utilizar o valor padrão de desenvolvimento."
                )
        return self

    # JWT & Auth
    PRIMARY_USER_EMAIL: str = "jvhernandez.dev@gmail.com"
    JWT_SECRET_KEY: str = "dev_secret_key_financial_pwa_local_only_1234567890abcdef"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 dias para conveniência de PWA pessoal

    # Pluggy Open Finance
    PLUGGY_CLIENT_ID: str | None = None
    PLUGGY_CLIENT_SECRET: str | None = None
    PLUGGY_BASE_URL: str = "https://api.pluggy.ai"

    # Cloudflare R2
    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET_NAME: str = "financeiro-backups"
    R2_ENDPOINT_URL: str | None = None
    AGE_PUBLIC_KEY: str | None = None

    # Cloudflare Tunnel
    CLOUDFLARE_TUNNEL_TOKEN: str | None = None

    # Web Push Notifications (VAPID - Fase 7.5)
    VAPID_PUBLIC_KEY: str = (
        "BOEKyXax1uxbQU6nAzsi5Bw4grKDBKh7vqSimWdkdRdrxWbcqQLGs6OzOpivWwA_WvgUV_LXxaxeKjhi_ZgOxZs"
    )
    VAPID_PRIVATE_KEY: str = "AqM2bXcRNhvGLIjSld6G7Svg35Cm4ifwiuGJ2RAfW7g"
    VAPID_CLAIMS_EMAIL: str = "mailto:jvhernandez.dev@gmail.com"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE), env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
