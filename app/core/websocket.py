import base64
import json
import logging

from fastapi import APIRouter, WebSocket

from app.models import PredictionResult
from app.core.state import canvas_state
import app.core.game_logic as game_logic

router = APIRouter()

active_listeners: list[WebSocket] = []

log = logging.getLogger("uvicorn")


@router.websocket("/listener")
async def register_listener(websocket: WebSocket):
    await websocket.accept()
    active_listeners.append(websocket)

    # 立即向新客户端同步状态
    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "game_state_update",
                    "payload": game_logic.game_state.to_dict(),
                }
            )
        )
    except Exception as e:
        log.warning(f"初始状态同步失败: {e}")

    try:
        while True:
            data = await websocket.receive_json()
            # 处理来自 canvas.html 的画布更新
            if data.get("type", "") == "canvas_update":
                data_url = data.get("data_url")
                if not data_url:
                    continue

                # 1. 更新全局状态
                canvas_state.set_latest_canvas(data_url)

                # 2. 解析并广播给 show.html
                img_bytes = canvas_state.get_latest_canvas_bytes()
                img_type = canvas_state.get_latest_canvas_type()

                if img_bytes and img_type:
                    # 3. 广播给 show.html
                    await on_image_updated(img_bytes, img_type)
            elif data.get("type", "") == "command":
                # 将命令转发给游戏逻辑处理器
                await game_logic.dispatch(data.get("payload"))
    except Exception:
        pass
    finally:
        active_listeners.remove(websocket)


async def on_image_updated(staged_image_bytes: bytes, staged_image_type: str):
    await on_boardcast(
        {
            "type": "image",
            "image": {
                "type": staged_image_type,
                "base64": base64.b64encode(staged_image_bytes).decode("utf-8"),
            },
        }
    )


async def on_predict_updated(staged_top5: list[PredictionResult]):
    await on_boardcast(
        {
            "type": "top5",
            "results": [
                {"label": result.label, "score": result.score} for result in staged_top5
            ],
        }
    )


async def on_boardcast(params: dict):
    json_text = json.dumps(params)
    for websocket in active_listeners:
        await websocket.send_text(json_text)


listener_description = """
用于监听的 WebSocket，在对应的资源更新时，会通过该 WebSocket 向前端发送新内容

其中包括 `image` 和 `top5` 类型，也包括 `/api/boardcast` 接口广播的内容

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
