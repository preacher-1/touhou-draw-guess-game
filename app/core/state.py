# app/core/state.py
import base64
import re


def parse_data_url(data_url: str) -> tuple[str | None, bytes | None]:
    """解析 data URL，返回 (media_type, raw_bytes)"""
    match = re.match(r"data:(?P<type>.*?);base64,(?P<data>.*)", data_url)
    if match:
        try:
            media_type = match.group("type")
            base64_data = match.group("data")
            raw_bytes = base64.b64decode(base64_data)
            return media_type, raw_bytes
        except Exception:
            return None, None
    return None, None


class CanvasState:
    def __init__(self):
        self._latest_canvas_b64_url: str | None = None
        self._latest_canvas_bytes: bytes | None = None
        self._latest_canvas_type: str | None = None

    def set_latest_canvas(self, data_url: str):
        self._latest_canvas_b64_url = data_url
        media_type, raw_bytes = parse_data_url(data_url)
        if media_type and raw_bytes:
            self._latest_canvas_bytes = raw_bytes
            self._latest_canvas_type = media_type

            from app.core.api import event_image_updated
            event_image_updated.set()

            print("canvas state updated")

    def get_latest_canvas(self) -> str | None:
        return self._latest_canvas_b64_url

    def get_latest_canvas_bytes(self) -> bytes | None:
        return self._latest_canvas_bytes

    def get_latest_canvas_type(self) -> str | None:
        return self._latest_canvas_type


canvas_state = CanvasState()
