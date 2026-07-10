import asyncio
import json
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


def event_payload(source: str = "system", severity: str = "info", message: str = "Realtime heartbeat") -> str:
    return json.dumps(
        {
            "id": f"evt-{datetime.now(UTC).timestamp()}",
            "severity": severity,
            "source": source,
            "message": message,
            "timestamp": datetime.now(UTC).isoformat(),
        },
        ensure_ascii=False,
    )


@router.websocket("/ws")
async def realtime_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_text(event_payload(message="Realtime monitor connected"))
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=20)
                await websocket.send_text(message)
            except TimeoutError:
                await websocket.send_text(event_payload(message="Realtime monitor heartbeat"))
    except WebSocketDisconnect:
        return
