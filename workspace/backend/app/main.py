from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db import Base, engine
from app.routers import buildings, geometry, gps_alignment, osm_tiles, project_data, security_devices, uploads, workflow
from app.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.auto_create_tables:
            Base.metadata.create_all(bind=engine)
        yield

    api = FastAPI(title=settings.app_name, lifespan=lifespan)
    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/ready", tags=["health"])
    def ready() -> dict[str, str]:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
        return {"status": "ready"}

    api.include_router(buildings.router)
    api.include_router(geometry.router)
    api.include_router(gps_alignment.router)
    api.include_router(osm_tiles.router)
    api.include_router(project_data.router)
    api.include_router(security_devices.router)
    api.include_router(uploads.router)
    api.include_router(workflow.router)
    return api


app = create_app()
