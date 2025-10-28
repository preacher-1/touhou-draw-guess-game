import os
from pathlib import Path

# 项目根目录
# Path(__file__) 获取当前文件路径 (config.py)
# .parent.parent 定位到 app/ 的上级目录，也就是项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 模型文件路径
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "yolo11m-02-01-best.onnx"
CLASS_NAMES_PATH = MODEL_DIR / "class_names.json"

# CPU工作进程数量
# os.cpu_count() 可以获取CPU的核心数，我们用它作为默认值
# max(1, ...) 确保至少有1个进程
CPU_WORKER_COUNT = max(1, os.cpu_count() // 2)

# 其它配置
PREDICT_INTERVAL = 1  # 预测间隔，单位秒
TIMER_MAX_VALUE = 90  # 计时器最大值，单位秒
