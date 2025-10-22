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


listener_description = """
用于监听的 WebSocket，在对应的资源更新时，会通过该 WebSocket 向前端发送新内容

其中包括 `image` 和 `top5` 两个类型

JSON 示例：

```json
{
    "type": "image",
    "image": {
        "type": "image/png",
        "base64": "iVBORw0KGgoAAAANSUhEUgAA..."
    }
}
```

```json
{
    "type": "top5",
    "results": [
        {
            "label": "saigyouji_yuyuko",
            "score": 0.9818522930145264
        },
        {
            "label": "onozuka_komachi",
            "score": 0.007961973547935486
        },
        {
            "label": "konpaku_youmu",
            "score": 0.004716822877526283
        },
        {
            "label": "maribel_hearn",
            "score": 0.0012106532230973244
        },
        {
            "label": "kaku_seiga",
            "score": 0.0011601087171584368
        }
    ]
}
```

前端示例：

```js
const ws = new WebSocket("/ws/listener")

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "image") {
        console.log("Receiving image ...");
        // ...
    } else if (data.type === "top5") {
        console.log("Receiving top5 ...")
        // ...
    }
};
```
"""

listener_docs = {
    "/ws/listener": {
        "description": listener_description,
    }
}
