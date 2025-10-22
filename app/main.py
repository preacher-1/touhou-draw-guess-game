# app/main.py (V0.1)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.websocket import manager
from app.core.state import canvas_state
from app.api.endpoints import predict
from fastapi.responses import RedirectResponse

# 创建FastAPI应用实例
app = FastAPI(title="东方杏坛铭AI推理API", version="0.1")

# --- 配置CORS中间件 ---
# 允许所有来源，方便前端本地开发调试
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 包含API路由 ---
# 将 predict.py 中定义的路由包含进来
app.include_router(predict.router, prefix="/api", tags=["Prediction"])

# 推荐：将静态资源挂载到 /static
app.mount("/static", StaticFiles(directory="frontend", html=True), name="static")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")


# 根路径重定向到前端首页
@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


# --- 定义WebSocket路由 ---
@app.websocket("/ws/canvas")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "hello":
                client_type = data.get(
                    "client", "unknown"
                )  # "canvas", "display", "admin"
                manager.set_client_type(websocket, client_type)

            elif data.get("type") == "canvas_update":
                # 1. 缓存最新图像
                canvas_state.set_latest_canvas(data["data_url"])

                # 2. 将画布更新广播给展示页和管理页
                await manager.broadcast(data, clients=["display", "admin"])

            # ... 处理 "ping" 等其他消息

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] 错误: {e}")
        manager.disconnect(websocket)
