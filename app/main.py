from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.core import api, websocket

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
app.include_router(api.router, prefix="/api", tags=["API"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])


# 注入 websocket 文档
origin_openapi = app.openapi


def custom_openapi(*args, **kwargs):
    ret = origin_openapi(*args, **kwargs)
    components = app.openapi_schema["components"]
    components["schemas"] = {**websocket.listener_docs, **components["schemas"]}
    return ret


app.openapi = custom_openapi

# 推荐：将静态资源挂载到 /static
app.mount("/static", StaticFiles(directory="frontend", html=True), name="static")


# 根路径重定向到前端首页
@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")
