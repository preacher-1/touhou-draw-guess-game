# app/core/state.py
class CanvasState:
    def __init__(self):
        self._latest_canvas_b64: str | None = None

    def set_latest_canvas(self, data_url: str):
        self._latest_canvas_b64 = data_url
        print("canvas state updated")

    def get_latest_canvas(self) -> str | None:
        return self._latest_canvas_b64


canvas_state = CanvasState()
