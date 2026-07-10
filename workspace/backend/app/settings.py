from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Building Editor Prototype API"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/total_building_db"
    redis_url: str = "redis://localhost:6379/0"
    upload_dir: str = "./uploads"
    auto_create_tables: bool = False
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    cors_origin_regex: str | None = None
    api_auth_enabled: bool = False
    api_access_token: str = "local-dev-token"
    api_token_header: str = "X-API-Token"
    request_logging_enabled: bool = True
    rate_limit_per_minute: int = 240
    upload_max_bytes_default: int = 100 * 1024 * 1024
    upload_max_bytes_image: int = 25 * 1024 * 1024
    upload_max_bytes_cad: int = 150 * 1024 * 1024
    upload_max_bytes_model: int = 300 * 1024 * 1024
    upload_max_bytes_pointcloud: int = 2 * 1024 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
