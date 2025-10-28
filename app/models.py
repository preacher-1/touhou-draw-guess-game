from pydantic import BaseModel


class BaseResponse(BaseModel):
    """
    基础 API 返回结构，只带有是否成功
    """

    success: bool = True


class PredictionResult(BaseModel):
    """
    定义单个分类结果的数据结构
    """

    label: str  # 物体类别
    score: float  # 置信度


class PredictionResponse(BaseResponse):
    """
    分类推理 API 返回的完整数据结构
    """

    results: list[PredictionResult]
