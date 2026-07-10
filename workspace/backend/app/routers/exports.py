from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/exports", tags=["exports"])


class WallExport(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class RoomExport(BaseModel):
    x: float
    y: float
    w: float
    h: float
    label: str | None = None


class DeviceExport(BaseModel):
    id: str
    x: float
    y: float
    device_type: str
    name: str
    angle: float | None = None


class ExportScenePayload(BaseModel):
    walls: list[WallExport] = Field(default_factory=list)
    rooms: list[RoomExport] = Field(default_factory=list)
    devices: list[DeviceExport] = Field(default_factory=list)


def number(value: float) -> str:
    if abs(value) < 1e-9:
        value = 0
    return str(int(value)) if float(value).is_integer() else f"{value:.4f}".rstrip("0").rstrip(".")


def dxf_pair(code: int, value: str | float | int) -> list[str]:
    return [str(code), str(value)]


def append_line(lines: list[str], layer: str, x1: float, y1: float, x2: float, y2: float) -> None:
    lines.extend(
        [
            *dxf_pair(0, "LINE"),
            *dxf_pair(8, layer),
            *dxf_pair(10, number(x1)),
            *dxf_pair(20, number(y1)),
            *dxf_pair(30, 0),
            *dxf_pair(11, number(x2)),
            *dxf_pair(21, number(y2)),
            *dxf_pair(31, 0),
        ]
    )


def export_dxf(payload: ExportScenePayload) -> str:
    lines: list[str] = [
        *dxf_pair(0, "SECTION"),
        *dxf_pair(2, "HEADER"),
        *dxf_pair(9, "$ACADVER"),
        *dxf_pair(1, "AC1009"),
        *dxf_pair(0, "ENDSEC"),
        *dxf_pair(0, "SECTION"),
        *dxf_pair(2, "ENTITIES"),
    ]
    for wall in payload.walls:
        append_line(lines, "WALLS", wall.x1, wall.y1, wall.x2, wall.y2)
    for room in payload.rooms:
        x1, y1 = room.x, room.y
        x2, y2 = room.x + room.w, room.y + room.h
        append_line(lines, "ROOMS", x1, y1, x2, y1)
        append_line(lines, "ROOMS", x2, y1, x2, y2)
        append_line(lines, "ROOMS", x2, y2, x1, y2)
        append_line(lines, "ROOMS", x1, y2, x1, y1)
    for device in payload.devices:
        lines.extend(
            [
                *dxf_pair(0, "CIRCLE"),
                *dxf_pair(8, f"DEVICE_{device.device_type.upper()}"),
                *dxf_pair(10, number(device.x)),
                *dxf_pair(20, number(device.y)),
                *dxf_pair(30, 0),
                *dxf_pair(40, 0.15),
            ]
        )
    lines.extend([*dxf_pair(0, "ENDSEC"), *dxf_pair(0, "EOF")])
    return "\n".join(lines) + "\n"


def export_csv(payload: ExportScenePayload) -> str:
    rows = ["id,name,device_type,x,y,angle"]
    for device in payload.devices:
        rows.append(
            ",".join(
                [
                    device.id,
                    device.name.replace(",", " "),
                    device.device_type,
                    number(device.x),
                    number(device.y),
                    "" if device.angle is None else number(device.angle),
                ]
            )
        )
    return "\n".join(rows) + "\n"


def export_package(payload: ExportScenePayload) -> str:
    return json_like(
        {
            "generated_at": datetime.now(UTC).isoformat(),
            "format_version": 1,
            "walls": [wall.model_dump() for wall in payload.walls],
            "rooms": [room.model_dump() for room in payload.rooms],
            "devices": [device.model_dump() for device in payload.devices],
            "summary": {
                "walls": len(payload.walls),
                "rooms": len(payload.rooms),
                "devices": len(payload.devices),
            },
        }
    )


def json_like(value: object) -> str:
    import json

    return f"{json.dumps(value, ensure_ascii=False, indent=2)}\n"


@router.post("/{export_format}")
def create_export(export_format: Literal["dxf", "csv", "package"], payload: ExportScenePayload) -> Response:
    if export_format == "dxf":
        return Response(export_dxf(payload), media_type="application/dxf")
    if export_format == "csv":
        return Response(export_csv(payload), media_type="text/csv")
    if export_format == "package":
        return Response(export_package(payload), media_type="application/json")
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported export format")
