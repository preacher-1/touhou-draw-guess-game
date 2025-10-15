# app/api/endpoints/predict.py (V0.1)

import asyncio
from concurrent.futures import ThreadPoolExecutor
import onnxruntime
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from typing import Annotated
from app.models.prediction import PredictionResponse
from app.utils.image_processing import preprocess_image, postprocess_output
from app.core.config import MODEL_PATH

router = APIRouter()

# 在全局加载模型。注意：这在多进程模式下每个进程都会加载一次
# 对于简单的同步版本，这没问题。
providers = (
    ["CPUExecutionProvider", "CUDAExecutionProvider"]
    if onnxruntime.get_device() == "GPU"
    else ["CPUExecutionProvider"]
)
session = onnxruntime.InferenceSession(
    str(MODEL_PATH), providers=["CPUExecutionProvider", "CUDAExecutionProvider"]
)
print(f"Model loaded: {MODEL_PATH}\nProviders: {session.get_providers()}")
input_name = session.get_inputs()[0].name

# 创建线程池
pool = ThreadPoolExecutor(max_workers=4)


# --- 依赖项：处理图片上传和推理 ---
# 我们将通用逻辑提取出来，避免代码重复
async def run_inference(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="File must be a JPEG or PNG image")

    image_bytes = await file.read()

    try:
        loop = asyncio.get_event_loop()
        input_tensor = await loop.run_in_executor(pool, preprocess_image, image_bytes)

        model_output = await loop.run_in_executor(
            pool, session.run, None, {input_name: input_tensor}
        )
        return model_output[0]
    except Exception as e:
        print(f"An error occurred during inference: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")


# --- API 端点 ---
@router.post(
    "/predict/top1", response_model=PredictionResponse, summary="Get Top-1 Prediction"
)
async def predict_top1(model_output: Annotated[np.ndarray, Depends(run_inference)]):
    """
    接收图片文件，执行分类推理并返回置信度最高的结果。
    """
    try:
        results = postprocess_output(model_output, top_k=1)
        return PredictionResponse(results=results)
    except Exception as e:
        return PredictionResponse(success=False, results=[], error_message=str(e))


@router.post(
    "/predict/top5", response_model=PredictionResponse, summary="Get Top-5 Predictions"
)
async def predict_top5(model_output: Annotated[np.ndarray, Depends(run_inference)]):
    """
    接收图片文件，执行分类推理并返回置信度**前5名**的结果。
    """
    try:
        results = postprocess_output(model_output, top_k=5)
        return PredictionResponse(results=results)
    except Exception as e:
        return PredictionResponse(success=False, results=[], error_message=str(e))
