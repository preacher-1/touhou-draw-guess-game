# app/utils/save_image.py
import os
import logging
from datetime import datetime
from pathlib import Path

# 确保导入 app 模块中的配置
from app.core.config import BASE_DIR
from app.core.state import canvas_state

# 导入 GameState 用于类型提示
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.game_logic import GameState


log = logging.getLogger("uvicorn")

# 自动创建 'history' 文件夹
HISTORY_DIR = BASE_DIR / "history"
os.makedirs(HISTORY_DIR, exist_ok=True)


def save_canvas_to_history(current_game_state: "GameState", reason: str = "auto"):
    """
    从 canvas_state 获取当前图像字节并保存到 history 文件夹

    Args:
        current_game_state (GameState): 用于生成文件名
        reason (str): 保存原因 ('auto' 或 'manual')
    """
    try:
        image_bytes = canvas_state.get_latest_canvas_bytes()
        image_type = canvas_state.get_latest_canvas_type()

        if not image_bytes or image_type is None:
            log.warning(f"[{reason}_save] 尝试保存图像失败：画布为空。")
            return None

        # 1. 获取文件扩展名
        # image_type 可能是 'image/png' 或 'image/jpeg'
        extension = ".png"  # 默认为 png
        if "jpeg" in image_type or "jpg" in image_type:
            extension = ".jpg"

        # 2. 生成文件名
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")

        if current_game_state.round_num > 0 and current_game_state.target_label:
            filename = (
                f"{timestamp}_R{current_game_state.round_num}"
                f"_T{current_game_state.try_num}"
                f"_{current_game_state.target_label}_{reason}{extension}"
            )
        else:
            # 游戏未开始时的手动保存
            filename = f"{timestamp}_MANUAL_SAVE_IDLE{extension}"

        file_path = HISTORY_DIR / filename

        # 3. 保存文件
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        log.info(f"[{reason}_save] 图像已保存到: {file_path}")
        return str(file_path)

    except Exception as e:
        log.error(f"[{reason}_save] 保存图像时发生严重错误: {e}")
        return None
