from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "ExtraAula API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./extraaula.db"
    AUTO_SEED: bool = True
    JWT_SECRET_KEY: str = "dev-secret-key-extraaula-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 720
    PLATFORM_COMMISSION_RATE: float = 0.15
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    CORS_ORIGIN_REGEX: str = r"https://.*\.vercel\.app"
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def normalized_database_url(self) -> str:
        """
        Normalizes PostgreSQL URLs from cloud providers (Render, Neon, Supabase)
        so SQLAlchemy 2.0 always uses psycopg2 cleanly.
        """
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg2://" + url[len("postgres://"):]
        if url.startswith("postgresql://") and "+psycopg2" not in url:
            return "postgresql+psycopg2://" + url[len("postgresql://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
