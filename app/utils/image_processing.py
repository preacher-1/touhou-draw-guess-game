# app/utils/image_processing.py

import cv2
import numpy as np
import json
from typing import List, Tuple
from app.models.prediction import PredictionResult
from app.core.config import CLASS_NAMES_PATH

# --- 模型输入参数 ---
MODEL_INPUT_SIZE = (224, 224)  # (width, height)


def load_class_names() -> List[str]:
    """从JSON文件中加载类别名称"""
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)
    return list(class_names.values())


# --- 模型输出参数 (根据您的模型修正) ---
CLASS_NAMES = load_class_names()


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    对输入的图片字节流进行预处理以适应分类模型
    """
    # 1. 从字节解码成OpenCV图像格式
    image_np = np.frombuffer(image_bytes, np.uint8)
    image_bgr = cv2.imdecode(image_np, cv2.IMREAD_COLOR)

    # 2. 转换颜色通道 BGR -> RGB
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    # 3. 图像缩放 (直接缩放到目标尺寸，分类任务通常不需要letterbox)
    resized_image = cv2.resize(
        image_rgb, MODEL_INPUT_SIZE, interpolation=cv2.INTER_LINEAR
    )

    # 4. 归一化 (0-255 -> 0.0-1.0)
    image_normalized = resized_image.astype(np.float32) / 255.0

    # 5. 转换维度 HWC -> CHW (Height, Width, Channel -> Channel, Height, Width)
    image_chw = np.transpose(image_normalized, (2, 0, 1))

    # 6. 增加一个批次维度 NCHW (Batch, Channel, Height, Width)
    input_tensor = np.expand_dims(image_chw, axis=0)

    return input_tensor


def postprocess_output(
    model_output: np.ndarray, top_k: int = 1
) -> List[PredictionResult]:
    """
    对分类模型的输出进行后处理，并返回Top-K个结果

    Args:
        model_output (np.ndarray): 模型的原始输出
        top_k (int): 需要返回的前k个结果数量

    Returns:
        List[PredictionResult]: 包含k个预测结果的列表
    """
    # 1. 移除批次维度 (1, 135) -> (135,)
    probabilities = model_output[0]

    # 2. 找到Top-K的类别索引
    # argsort默认升序，所以我们用 [::-1] 来反转得到降序
    # 然后取前 k 个
    top_k_indices = np.argsort(probabilities)[::-1][:top_k]

    # 3. 组装结果列表
    results = []
    for i in top_k_indices:
        results.append(
            PredictionResult(label=CLASS_NAMES[i], score=float(probabilities[i]))
        )

    return results
