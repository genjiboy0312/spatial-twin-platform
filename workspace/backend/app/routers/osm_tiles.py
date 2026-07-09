from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Response, status

router = APIRouter(prefix="/api/osm-tiles", tags=["osm-tiles"])


@router.get("/{z}/{x}/{y}.png")
def get_osm_tile(z: int, x: int, y: int) -> Response:
    if z < 0 or z > 19:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tile zoom")

    tile_count = 2**z
    if y < 0 or y >= tile_count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tile y")

    wrapped_x = x % tile_count
    url = f"https://tile.openstreetmap.org/{z}/{wrapped_x}/{y}.png"
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
    except URLError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="OSM tile fetch failed") from exc

    return Response(
        content=content,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )
