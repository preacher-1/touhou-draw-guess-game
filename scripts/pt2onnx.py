from ultralytics import YOLO

# Load a model
# model = YOLO("yolo11n.pt")  # load an official model
model = YOLO("../models/yolo11m-02-01-best.pt")  # load a custom trained model

# Export the model
model.export(format="onnx")
