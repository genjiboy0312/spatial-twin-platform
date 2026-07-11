from pathlib import Path
from time import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Response, status

from app.settings import get_settings

router = APIRouter(prefix="/api/osm-tiles", tags=["osm-tiles"])


@router.get("/status")
def get_osm_tile_status() -> dict[str, object]:
    settings = get_settings()
    cache_dir = Path(settings.osm_tile_cache_dir)
    return {
        "provider": settings.osm_tile_provider_name,
        "provider_url_template": settings.osm_tile_provider_url,
        "cache_enabled": True,
        "cache_dir": str(cache_dir),
        "cache_ttl_seconds": settings.osm_tile_cache_ttl_seconds,
        "fallback_enabled": settings.osm_tile_offline_fallback_enabled,
    }


@router.get("/{z}/{x}/{y}.png")
def get_osm_tile(z: int, x: int, y: int) -> Response:
    if z < 0 or z > 19:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tile zoom")

    tile_count = 2**z
    if y < 0 or y >= tile_count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tile y")

    settings = get_settings()
    wrapped_x = x % tile_count
    cache_path = Path(settings.osm_tile_cache_dir) / str(z) / str(wrapped_x) / f"{y}.png"
    if _is_fresh_cache(cache_path, settings.osm_tile_cache_ttl_seconds):
        return _tile_response(cache_path.read_bytes(), settings.osm_tile_provider_name, "hit", "false")

    url = settings.osm_tile_provider_url.format(z=z, x=wrapped_x, y=y)
    request = Request(
        url,
        headers={
            "User-Agent": "spatial-twin-platform-local/0.1 (+https://localhost)",
            "Accept": "image/png,image/*;q=0.8,*/*;q=0.5",
        },
    )

    try:
        with urlopen(request, timeout=8) as remote:
            content = remote.read()
    except (HTTPError, URLError, TimeoutError):
        if cache_path.exists():
            return _tile_response(cache_path.read_bytes(), settings.osm_tile_provider_name, "stale", "stale-cache")
        if settings.osm_tile_offline_fallback_enabled:
            return Response(
                content=_fallback_svg(z, wrapped_x, y),
                media_type="image/svg+xml",
                headers=_tile_headers(settings.osm_tile_provider_name, "miss", "generated"),
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="OSM tile fetch failed")

    _write_cache(cache_path, content)
    return _tile_response(content, settings.osm_tile_provider_name, "miss", "false")


def _is_fresh_cache(path: Path, ttl_seconds: int) -> bool:
    return path.exists() and (time() - path.stat().st_mtime) <= ttl_seconds


def _write_cache(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_bytes(content)
    temp_path.replace(path)


def _tile_headers(provider: str, cache_state: str, fallback_state: str) -> dict[str, str]:
    return {
        "Cache-Control": "public, max-age=86400",
        "X-OSM-Provider": provider,
        "X-OSM-Cache": cache_state,
        "X-OSM-Fallback": fallback_state,
    }


def _tile_response(content: bytes, provider: str, cache_state: str, fallback_state: str) -> Response:
    return Response(content=content, media_type="image/png", headers=_tile_headers(provider, cache_state, fallback_state))


def _fallback_svg(z: int, x: int, y: int) -> bytes:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<rect width="256" height="256" fill="#d7d7d2"/>
<path d="M-20 64 C48 42 80 70 136 54 C186 40 220 54 276 34 L276 86 C206 104 164 90 112 106 C56 122 24 104 -20 126Z" fill="#bac5a4"/>
<path d="M-16 166 L272 116" stroke="#a8a8a8" stroke-width="18" opacity=".82"/>
<path d="M-10 206 L266 186" stroke="#b6b6b6" stroke-width="10" opacity=".75"/>
<path d="M42 52 H96 V98 H42Z M156 128 H218 V178 H156Z M70 180 H128 V226 H70Z" fill="none" stroke="#6b8fd6" stroke-width="4" opacity=".68"/>
<text x="16" y="238" fill="#555" font-family="Arial, sans-serif" font-size="12">OSM fallback z{z}/{x}/{y}</text>
</svg>"""
    return svg.encode("utf-8")
