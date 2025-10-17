# app/main.py (V0.1)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import predict

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


# --- 定义根路径 ---
@app.get("/")
def read_root():
    return {"message": "欢迎使用东方杏坛铭AI推理API。访问 /docs 查看API文档。"}
