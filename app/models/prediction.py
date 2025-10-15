# app/models/prediction.py

from pydantic import BaseModel
from typing import List, Optional


class PredictionResult(BaseModel):
    """
    定义单个分类结果的数据结构
    """

    label: str  # 物体类别
    score: float  # 置信度


class PredictionResponse(BaseModel):
    """
    定义API返回的完整数据结构
    """

    success: bool = True
    results: List[PredictionResult]
    error_message: Optional[str] = None
