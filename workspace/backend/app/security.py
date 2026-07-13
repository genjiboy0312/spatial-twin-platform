import logging
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from app.auth_sessions import is_valid_token
from app.settings import get_settings

PUBLIC_API_PATHS = {"/api/auth/login"}
PUBLIC_PATHS = {"/health", "/ready", *PUBLIC_API_PATHS}
RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
LOGGER = logging.getLogger("spatial_twin.api")


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
    started_at = time.perf_counter()
    client_key = request.client.host if request.client else "unknown"

    if settings.rate_limit_per_minute > 0 and request.url.path.startswith("/api"):
        now = time.time()
        bucket = RATE_BUCKETS[client_key]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= settings.rate_limit_per_minute:
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
        bucket.append(now)

    if not settings.api_auth_enabled:
        response = await call_next(request)
        _log_request(request, response, started_at, settings.request_logging_enabled)
        return response

    path = request.url.path
    if path in PUBLIC_PATHS or not path.startswith("/api"):
        response = await call_next(request)
        _log_request(request, response, started_at, settings.request_logging_enabled)
        return response

    if not is_valid_token(token_from_request(request)):
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API token"})

    response = await call_next(request)
    _log_request(request, response, started_at, settings.request_logging_enabled)
    return response


def _log_request(request: Request, response: Response, started_at: float, enabled: bool) -> None:
    if not enabled:
        return
    duration_ms = (time.perf_counter() - started_at) * 1000
    LOGGER.info(
        "%s %s -> %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
