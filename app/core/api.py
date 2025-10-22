
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
from app.core.websocket import on_image_updated, on_predict_updated
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


# region 更新图片

def check_is_image(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="File must be a JPEG or PNG image")
    return file


staged_image_bytes: bytes | None = None
staged_image_type: str | None = None


@router.post(
    "/update_image",
    response_model=BaseResponse,
    responses={
        400: dict(description="File must be a JPEG or PNG image")
    },
    summary="更新暂存的图片文件",
    description="更新图片并转发给所有监听客户端\n\n不会立刻进行分类推理计算，分类推理计算会按照后端固定的间隔进行"
)
async def update_image(file: Annotated[UploadFile, Depends(check_is_image)]):
    global staged_image_bytes, staged_image_type
    staged_image_bytes = await file.read()
    staged_image_type = file.content_type
    asyncio.create_task(on_image_updated(staged_image_bytes, staged_image_type))
    return BaseResponse()


@router.get(
    "/get_image",
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
    },
    summary="获取当前暂存的图像",
    description="推荐使用 `/ws/listener` 监听 `type: \"image\"` 避免反复轮询"
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

    asyncio.create_task(on_predict_updated(staged_top5))


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
    "/top1",
    response_model=PredictionResponse,
    responses={
        404: dict(description="No staged result ready yet")
    },
    summary="得到 Top-1 的结果",
    description="推荐使用 `/ws/listener` 监听 `type: \"top5\"` 避免反复轮询"
)
async def predict_top1():
    """
    返回当前置信度最高的结果。
    """
    if staged_top5 is None:
        raise HTTPException(status_code=404, detail="No staged result ready yet")
    return PredictionResponse(results=staged_top5[:1])


@router.get(
    "/top5",
    response_model=PredictionResponse,
    responses={
        404: dict(description="No staged result ready yet")
    },
    summary="得到 Top-5 的结果",
    description="推荐使用 `/ws/listener` 监听 `type: \"top5\"` 避免反复轮询"
)
async def predict_top5():
    """
    返回当前置信度前5名的结果。
    """
    if staged_top5 is None:
        raise HTTPException(status_code=404, detail="No staged result ready yet")
    return PredictionResponse(results=staged_top5)
