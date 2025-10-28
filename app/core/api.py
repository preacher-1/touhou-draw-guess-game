import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import onnxruntime
from fastapi import (
    APIRouter,
    FastAPI,
    HTTPException,
    Response,
)

from app.core.config import MODEL_PATH, PREDICT_INTERVAL, TIMER_MAX_VALUE
from app.core.state import canvas_state
from app.core.websocket import on_boardcast, on_predict_updated
from app.models import BaseResponse, PredictionResponse, PredictionResult
from app.utils.fix_job_time import fix_job_time
from app.utils.image_processing import (
    format_results,
    postprocess_output,
    preprocess_image,
)
import app.core.game_logic as game_logic

log = logging.getLogger("uvicorn")


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

    asyncio.create_task(predict_timer())
    asyncio.create_task(game_logic.game_timer_task())

    yield


router = APIRouter(lifespan=lifespan)


# region 更新图片


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
        404: dict(description="No staged image ready yet"),
    },
    summary="获取当前暂存的图像",
    description='推荐使用 `/ws/listener` 监听 `type: "image"` 避免反复轮询',
)
async def get_image():
    image_bytes = canvas_state.get_latest_canvas_bytes()
    image_type = canvas_state.get_latest_canvas_type()
    if image_bytes is None:
        raise HTTPException(status_code=404, detail="No staged image ready yet")
    return Response(content=image_bytes, media_type=image_type)


# endregion


# region 定时计算暂存的图片的模型推理结果

event_image_updated = asyncio.Event()
staged_top5: list[PredictionResult] | None = None


async def predict_timer():
    while True:
        await event_image_updated.wait()
        event_image_updated.clear()
        async with fix_job_time(PREDICT_INTERVAL):
            try:
                await do_predict_for_staged_image()
            except Exception as e:
                log.error(f"定时推理任务出现错误：{e}")


async def do_predict_for_staged_image():
    global staged_top5

    current_image_bytes = canvas_state.get_latest_canvas_bytes()
    assert current_image_bytes is not None

    model_output = await run_inference(current_image_bytes)
    staged_top5 = postprocess_output(model_output, top_k=5)

    log.info(f"当前推理结果：{format_results(staged_top5)}")

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
    responses={404: dict(description="No staged result ready yet")},
    summary="得到 Top-1 的结果",
    description='推荐使用 `/ws/listener` 监听 `type: "top5"` 避免反复轮询',
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
    responses={404: dict(description="No staged result ready yet")},
    summary="得到 Top-5 的结果",
    description='推荐使用 `/ws/listener` 监听 `type: "top5"` 避免反复轮询',
)
async def predict_top5():
    """
    返回当前置信度前5名的结果。
    """
    if staged_top5 is None:
        raise HTTPException(status_code=404, detail="No staged result ready yet")
    return PredictionResponse(results=staged_top5)


# endregion


# region 定时器与广播接口

# reset_event = asyncio.Event()
# start_event = asyncio.Event()


# async def game_timer_task():
#     while True:
#         await start_event.wait()

#         for remaining in range(TIMER_MAX_VALUE, -1, -1):
#             async with fix_job_time(1):
#                 if reset_event.is_set():
#                     break
#                 await on_boardcast(
#                     {"type": "timer", "value": remaining, "by": "countdown"}
#                 )
#         else:
#             await reset_event.wait()


# @router.post(
#     "/reset_timer",
#     response_model=BaseResponse,
#     summary="重置定时器",
#     description=f'将定时器重置并暂停，会广播 `{{"type": "timer", "value": {TIMER_MAX_VALUE}, "by": "reset"}}` 给所有监听客户端',
# )
# async def reset_game_timer():
#     """
#     重置定时器。
#     """
#     reset_event.set()
#     start_event.clear()
#     asyncio.create_task(
#         on_boardcast({"type": "timer", "value": TIMER_MAX_VALUE, "by": "reset"})
#     )
#     return BaseResponse()


# @router.post(
#     "/start_timer",
#     response_model=BaseResponse,
#     summary="启动定时器",
#     description='启动定时器，会每隔一秒钟广播 `{"type": "timer", "value": (剩余时间), "by": "countdown"}` 给所有监听客户端',
# )
# async def start_game_timer():
#     """
#     启动定时器。
#     """
#     start_event.set()
#     reset_event.clear()
#     return BaseResponse()


@router.post(
    "/boardcast",
    response_model=BaseResponse,
    responses={400: dict(description="Missing required field: 'type'")},
    summary="向所有监听客户端广播提供的参数",
    description="需要带有 `type` 字段，以便客户端区分消息类型",
)
async def boardcast(params: dict):
    """
    向所有监听客户端广播提供的参数。
    """
    if "type" not in params:
        raise HTTPException(status_code=400, detail="Missing required field: 'type'")
    asyncio.create_task(on_boardcast(params))
    return BaseResponse()


# endregion
