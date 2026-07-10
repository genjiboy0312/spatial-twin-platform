from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from app.settings import get_settings

PUBLIC_API_PATHS = {"/api/auth/login"}
PUBLIC_PATHS = {"/health", "/ready", *PUBLIC_API_PATHS}


def token_from_request(request: Request) -> str | None:
    settings = get_settings()
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.headers.get(settings.api_token_header)


async def api_token_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    settings = get_settings()
    if not settings.api_auth_enabled:
        return await call_next(request)

    path = request.url.path
    if path in PUBLIC_PATHS or not path.startswith("/api"):
        return await call_next(request)

    if token_from_request(request) != settings.api_access_token:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API token"})

    return await call_next(request)
