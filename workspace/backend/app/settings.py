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

    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
