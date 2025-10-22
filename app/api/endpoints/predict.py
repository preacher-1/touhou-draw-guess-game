
import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Annotated

import onnxruntime
from fastapi import (APIRouter, Depends, FastAPI, File, HTTPException,
                     Response, UploadFile)

from app.core.config import MODEL_PATH
from app.models import BaseResponse, PredictionResponse, PredictionResult
from app.utils.image_processing import (format_results, postprocess_output,
                                        preprocess_image)

log = logging.getLogger('uvicorn')


@asynccontextmanager
async def lifespan(app: FastAPI):
    global session, input_name

    # 加载模型
    providers = (
        ["CPUExecutionProvider", "CUDAExecutionProvider"]
        if onnxruntime.get_device() == "GPU"
        else ["CPUExecutionProvider"]
    )
    session = onnxruntime.InferenceSession(str(MODEL_PATH), providers=providers)
    print(f"Model loaded: {MODEL_PATH}\nProviders: {session.get_providers()}")
    input_name = session.get_inputs()[0].name

    start_predict_timer()

    yield


router = APIRouter(lifespan=lifespan)


def check_is_image(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="File must be a JPEG or PNG image")
    return file


# region 更新图片

staged_image_bytes: bytes | None = None
staged_image_type: str | None = None


@router.post(
    "/predict/update_image",
    response_model=BaseResponse,
    summary="更新暂存的图片文件",
    responses={
        400: dict(description="File must be a JPEG or PNG image")
    }
)
async def update_image(file: Annotated[UploadFile, Depends(check_is_image)]):
    global staged_image_bytes, staged_image_type
    staged_image_bytes = await file.read()
    staged_image_type = file.content_type
    return BaseResponse()


@router.get(
    "/predict/get_image",
    summary="获取当前暂存的图像",
    response_class=Response,
    responses={
        200: {
            "description": "Returns the staged image (JPEG or PNG)",
            "content": {
                "image/png": {},
                "image/jpeg": {},
            },
        },
        404: dict(description="No staged image ready yet")
    }
)
async def get_image():
    if staged_image_bytes is None:
        raise HTTPException(status_code=404, detail="No staged image ready yet")
    return Response(content=staged_image_bytes, media_type=staged_image_type)

# endregion


# region 定时计算暂存的图片的模型推理结果

computed_bytes: bytes | None = None     # 用于判断图片是否更新，详见 do_predict_for_staged_image
staged_top5: list[PredictionResult] | None = None


def start_predict_timer():
    asyncio.create_task(predict_timer())


async def predict_timer():
    interval = 1

    while True:
        start_time = time.monotonic()

        try:
            await do_predict_for_staged_image()
        except Exception as e:
            log.error(f"定时推理任务出现错误：{e}")

        # 计算任务耗时，await (计划用时 - 任务耗时) 即可让任务定时触发
        elapsed = time.monotonic() - start_time
        wait_time = max(0, interval - elapsed)
        await asyncio.sleep(wait_time)


async def do_predict_for_staged_image():
    global staged_top5, computed_bytes

    # 如果没有暂存的图片，则不处理
    if staged_image_bytes is None:
        return
    # 如果暂存的图片没有更新，则不处理
    if computed_bytes is not None and computed_bytes is staged_image_bytes:
        return

    model_output = await run_inference(staged_image_bytes)
    staged_top5 = postprocess_output(model_output, top_k=5)
    computed_bytes = staged_image_bytes
    log.info(f'当前推理结果：{format_results(staged_top5)}')


pool = ThreadPoolExecutor(max_workers=4)


async def run_inference(image_bytes: bytes):
    try:
        loop = asyncio.get_event_loop()
        input_tensor = await loop.run_in_executor(pool, preprocess_image, image_bytes)

        model_output = await loop.run_in_executor(
            pool, session.run, None, {input_name: input_tensor}
        )
        return model_output[0]
    except Exception as e:
        # print(f"An error occurred during inference: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

# endregion


# region 获取分类推理结果相关的 API

@router.get(
    "/predict/top1",
    response_model=PredictionResponse,
    summary="得到 Top-1 的结果",
    responses={
        404: dict(description="No staged result ready yet")
    }
)
async def predict_top1():
    """
    返回当前置信度最高的结果。
    """
    if staged_top5 is None:
        raise HTTPException(status_code=404, detail="No staged result ready yet")
    return PredictionResponse(results=staged_top5[:1])


@router.get(
    "/predict/top5",
    response_model=PredictionResponse,
    summary="得到 Top-5 的结果",
    responses={
        404: dict(description="No staged result ready yet")
    }
)
async def predict_top5():
    """
    返回当前置信度前5名的结果。
    """
    if staged_top5 is None:
        raise HTTPException(status_code=404, detail="No staged result ready yet")
    return PredictionResponse(results=staged_top5)


@router.get(
    "/predict/top1/mock", response_model=PredictionResponse, summary="得到模拟的 Top-1 结果（用于测试）",
)
async def predict_top1_mock():
    """
    返回模拟的置信度最高的结果，用于测试。
    """
    # 这里返回一个硬编码的模拟结果
    mock_result = [{"label": "alice_margatroid", "score": 0.9}]
    return PredictionResponse(results=mock_result)


@router.get(
    "/predict/top5/mock",
    response_model=PredictionResponse,
    summary="得到模拟的 Top-5 结果（用于测试）",
)
async def predict_top5_mock():
    """
    返回模拟的置信度前5名的结果，用于测试。
    """
    # 这里返回一些硬编码的模拟结果
    mock_results = [
        {"label": "alice_margatroid", "score": 0.9},
        {"label": "konpaku_youmu", "score": 0.05},
        {"label": "tamatsukuri_misumaru", "score": 0.03},
        {"label": "usami_renko", "score": 0.01},
        {"label": "ebisu_eika", "score": 0.009},
    ]
    return PredictionResponse(results=mock_results)

# endregion
