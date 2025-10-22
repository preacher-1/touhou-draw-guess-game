import base64
import json

from fastapi import APIRouter, WebSocket

from app.models import PredictionResult

router = APIRouter()

active_listeners: list[WebSocket] = []


@router.websocket("/listener")
async def register_listener(websocket: WebSocket):
    await websocket.accept()
    active_listeners.append(websocket)

    try:
        while True:
            msg = await websocket.receive()
            if msg.get('type', '') == 'websocket.disconnect':
                break
    finally:
        active_listeners.remove(websocket)


async def on_image_updated(staged_image_bytes: bytes, staged_image_type: str):
    json_text = json.dumps({
        "type": "image",
        "image": {
            "type": staged_image_type,
            "base64": base64.b64encode(staged_image_bytes).decode("utf-8"),
        }
    })
    for websocket in active_listeners:
        await websocket.send_text(json_text)


async def on_predict_updated(staged_top5: list[PredictionResult]):
    json_text = json.dumps({
        "type": "top5",
        "results": [
            {
                "label": result.label,
                "score": result.score
            }
            for result in staged_top5
        ]
    })
    for websocket in active_listeners:
        await websocket.send_text(json_text)
