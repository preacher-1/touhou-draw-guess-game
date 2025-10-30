# app/core/game_logic.py
import asyncio
import logging

from app.utils.fix_job_time import fix_job_time
from app.core.config import TIMER_MAX_VALUE
from app.utils.save_image import save_canvas_to_history


log = logging.getLogger("uvicorn")


GAME_ROUNDS_DATA = [
    {"label": "hakurei_reimu", "name": "博丽灵梦"},
    {"label": "kirisame_marisa", "name": "雾雨魔理沙"},
    {"label": "izayoi_sakuya", "name": "十六夜咲夜"},
]
TOTAL_ROUNDS = len(GAME_ROUNDS_DATA)


class GameState:
    def __init__(self):
        self.round_num: int = 0  # 0 表示游戏未开始
        self.try_num: int = 1
        self.phase: str = "IDLE"  # IDLE, WAITING, DRAWING, REVEAL_WAITING
        self.target_label: str | None = None
        self.target_name: str | None = None

        self.current_timer_value: int = TIMER_MAX_VALUE

    def set_phase(self, new_phase: str):
        log.info(f"游戏阶段变更: {self.phase} -> {new_phase}")
        self.phase = new_phase

    def next_round(self):
        """进入下一轮"""
        if self.round_num < TOTAL_ROUNDS:
            self.round_num = 1
            self.try_num = 1
            self.phase = "WAITING"
            self._update_target()
            return True
        return False  # 游戏已结束

    def next_try(self):
        """进入下一次尝试"""
        if self.try_num < 2:
            self.try_num = 1
            self.phase = "WAITING"
            return True
        return False  # 两次机会已用完

    def reset_game(self):
        self.round_num = 0
        self.try_num = 1
        self.phase = "IDLE"
        self.target_label = None
        self.target_name = None
        self.current_timer_value = TIMER_MAX_VALUE

    def _update_target(self):
        if 0 < self.round_num <= TOTAL_ROUNDS:
            data = GAME_ROUNDS_DATA[self.round_num - 1]
            self.target_label = data["label"]
            self.target_name = data["name"]

    def to_dict(self):
        """返回可序列化为 JSON 的状态"""
        return {
            "round": self.round_num,
            "try_num": self.try_num,
            "phase": self.phase,
            "target_label": self.target_label,
            "target_name": self.target_name,
            "total_rounds": TOTAL_ROUNDS,
            "timer_value": self.current_timer_value,
        }


# 全局游戏状态
game_state = GameState()

# 计时器事件
reset_event = asyncio.Event()
start_event = asyncio.Event()


async def broadcast_game_state():
    """广播当前游戏状态给所有客户端"""
    from app.core.websocket import on_boardcast

    log.info(f"广播状态: {game_state.to_dict()}")
    await on_boardcast({"type": "game_state_update", "payload": game_state.to_dict()})


async def clear_canvas_and_broadcast():
    """清空画布并广播"""
    from app.core.state import canvas_state
    from app.core.websocket import on_image_updated

    # 1. 清空服务器状态
    # (我们用一个空的 data url 来表示清空)
    canvas_state.set_latest_canvas("data:,")

    # 2. 广播空图片
    # (show.js 的 updateImage 逻辑会处理这个空 base64 并显示占位符)
    await on_image_updated(b"", "image/png")


async def game_timer_task():
    """
    后台计时器任务。
    """
    # --- 在函数内部导入 on_boardcast ---
    from app.core.websocket import on_boardcast

    while True:
        await start_event.wait()

        if game_state.phase != "DRAWING":
            log.warning("Start_event 被设置，但状态不是 DRAWING，已忽略")
            start_event.clear()  # 清除误触发的事件
            continue

        for remaining in range(TIMER_MAX_VALUE, -1, -1):
            game_state.current_timer_value = remaining
            async with fix_job_time(1):
                if reset_event.is_set():
                    break
                await on_boardcast(
                    {"type": "timer", "value": remaining, "by": "countdown"}
                )
        else:
            log.info("计时器自然结束")

            try:
                loop = asyncio.get_running_loop()
                # 在 executor 中运行同步的 IO 操作，避免阻塞
                await loop.run_in_executor(
                    None, save_canvas_to_history, game_state, "auto"
                )
            except Exception as e:
                log.error(f"自动保存图像失败: {e}")

            game_state.set_phase("REVEAL_WAITING")  # 切换到“等待揭晓”
            await broadcast_game_state()
            # 计时器结束后，重置 game_state 值
            reset_event.set()  # (确保 wait() 不会卡住)
            game_state.current_timer_value = TIMER_MAX_VALUE

        await reset_event.wait()  # 等待下一次重置
        game_state.current_timer_value = TIMER_MAX_VALUE


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
        if game_state.phase == "IDLE":
            log.warning("在 IDLE 状态下重置计时器，已忽略状态变更")
        else:
            log.info("处理命令: RESET_TIMER")
            game_state.set_phase("WAITING")  # 重置时，进入“等待开始”

        reset_event.set()
        start_event.clear()

        await broadcast_game_state()

        # 发送一个独立的 reset 消息
        await on_boardcast({"type": "timer", "value": TIMER_MAX_VALUE, "by": "reset"})

    elif action == "START_TIMER":
        # 只有在“等待”阶段才能开始
        if game_state.phase == "WAITING":
            log.info("处理命令: START_TIMER")
            game_state.set_phase("DRAWING")  # 切换到“绘画中”

            start_event.set()
            reset_event.clear()

            await broadcast_game_state()  # 广播新状态
        else:
            log.warning(f"在 {game_state.phase} 阶段收到 START_TIMER，已忽略")

    elif action == "START_NEXT_ROUND":
        log.info("处理命令: START_NEXT_ROUND")
        if game_state.phase not in ["IDLE", "WAITING", "REVEAL_WAITING"]:
            log.warning(f"在 {game_state.phase} 阶段收到 START_NEXT_ROUND，已忽略")
            return

        if game_state.next_round():
            log.info(f"进入第 {game_state.round_num} 轮, 第 1 次尝试")
        else:
            log.info("游戏所有轮次已结束，重置游戏")
            game_state.reset_game()

        await broadcast_game_state()
        await clear_canvas_and_broadcast()

        reset_event.set()
        start_event.clear()
        await on_boardcast({"type": "timer", "value": TIMER_MAX_VALUE, "by": "reset"})

    elif action == "START_NEXT_TRY":
        log.info("处理命令: START_NEXT_TRY")
        if game_state.phase not in ["WAITING", "REVEAL_WAITING"]:
            log.warning(f"在 {game_state.phase} 阶段收到 START_NEXT_TRY，已忽略")
            return

        if game_state.try_num == 1 and game_state.next_try():
            log.info(f"进入第 {game_state.round_num} 轮, 第 2 次尝试")
            await broadcast_game_state()
            await clear_canvas_and_broadcast()

            reset_event.set()
            start_event.clear()
            await on_boardcast(
                {"type": "timer", "value": TIMER_MAX_VALUE, "by": "reset"}
            )
        else:
            log.warning("无法开始第 2 次尝试 (已是第 2 次尝试或状态错误)")

    elif action == "REVEAL_RESULTS":
        # 必须在“等待揭晓”阶段才能揭晓
        if game_state.phase == "REVEAL_WAITING":
            log.info("处理命令: REVEAL_RESULTS")

            # --- 使用函数内导入来安全地获取 api.py 的数据 ---
            from app.core.api import staged_top5 as api_staged_top5

            final_results_list = []
            if api_staged_top5:
                final_results_list = [
                    {"label": r.label, "score": r.score} for r in api_staged_top5
                ]

            await on_boardcast(
                {"type": "final_results", "payload": {"results": final_results_list}}
            )
        else:
            log.warning(f"在 {game_state.phase} 阶段收到 REVEAL_RESULTS，已忽略")

    elif action == "SAVE_CANVAS_MANUAL":
        log.info("处理命令: SAVE_CANVAS_MANUAL")
        try:
            loop = asyncio.get_running_loop()
            # 在 executor 中运行同步 IO，避免阻塞 WebSocket
            file_path = await loop.run_in_executor(
                None, save_canvas_to_history, game_state, "manual"
            )
            if file_path:
                log.info(f"手动保存成功: {file_path}")
                # (未来可以考虑向管理员发回一个确认通知)
            else:
                log.warning("手动保存失败 (函数返回 None)")
        except Exception as e:
            log.error(f"手动保存命令执行失败: {e}")

    else:
        log.warning(f"收到未知的 action: {action}")
