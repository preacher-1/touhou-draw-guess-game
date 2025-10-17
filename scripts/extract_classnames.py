MODEL_PATH = "D:/PycharmProjects/touhou-jigsaw-game/models/yolo11m-02-01-best.onnx"

from ultralytics import YOLO

model = YOLO(MODEL_PATH, task="classify")

print(model.names)
