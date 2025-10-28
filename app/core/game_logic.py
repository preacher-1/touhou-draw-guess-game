# app/core/game_logic.py
import asyncio
import logging

from app.utils.fix_job_time import fix_job_time
from app.core.config import TIMER_MAX_VALUE


log = logging.getLogger("uvicorn")


# class GameState:
#     ...
# game_state = GameState()

reset_event = asyncio.Event()
start_event = asyncio.Event()


async def game_timer_task():
    """
    后台计时器任务。
    """
    # --- 在函数内部导入 on_boardcast ---
    from app.core.websocket import on_boardcast

    while True:
        await start_event.wait()

        for remaining in range(TIMER_MAX_VALUE, -1, -1):
            async with fix_job_time(1):
                if reset_event.is_set():
                    break
                await on_boardcast(
                    {"type": "timer", "value": remaining, "by": "countdown"}
                )
        else:
            await reset_event.wait()


async def dispatch(command: dict):
    """
    处理来自客户端的 'command' 类型消息
    """
    # --- 在函数内部导入 on_boardcast ---
    from app.core.websocket import on_boardcast

    if not command or "action" not in command:
        log.warning(f"收到无效命令: {command}")
        return

    action = command.get("action")

    if action == "RESET_TIMER":
        log.info("处理命令: RESET_TIMER")
        # 这部分逻辑现在完全在 game_logic 内部
        reset_event.set()
        start_event.clear()
        await on_boardcast({"type": "timer", "value": TIMER_MAX_VALUE, "by": "reset"})

    elif action == "START_TIMER":
        log.info("处理命令: START_TIMER")
        start_event.set()
        reset_event.clear()

    else:
        log.warning(f"收到未知的 action: {action}")
