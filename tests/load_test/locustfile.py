import os
import random
from locust import HttpUser, task, between

# --- 准备测试图片 ---
# 在 tests/load_test/ 目录下创建一个名为 'test_images' 的文件夹
# 并放入5-10张用来测试的 .jpg 或 .png 图片
TEST_IMAGES_DIR = os.path.join(os.path.dirname(__file__), "test_images")
if not os.path.exists(TEST_IMAGES_DIR):
    os.makedirs(TEST_IMAGES_DIR)
    # 需要手动将图片放入这个文件夹

# 确保文件夹不为空
try:
    IMAGE_FILES = [
        f for f in os.listdir(TEST_IMAGES_DIR) if f.endswith((".jpg", ".png"))
    ]
    if not IMAGE_FILES:
        raise FileNotFoundError(
            "No images found in test_images directory. Please add some."
        )
except FileNotFoundError as e:
    print(f"Error: {e}")
    exit(1)


class APIUser(HttpUser):
    # wait_time 定义了每个模拟用户在执行下一个任务前的等待时间
    # between(1, 3) 表示等待1到3秒之间的随机时间
    wait_time = between(1, 3)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 预加载所有图片数据到内存中
        self.loaded_images = {}
        for image_name in IMAGE_FILES:
            image_path = os.path.join(TEST_IMAGES_DIR, image_name)
            with open(image_path, "rb") as image_file:
                self.loaded_images[image_name] = image_file.read()

    @task(5)  # 权重为5，表示这个任务被选中的频率较低
    def predict_top1(self):
        self._make_prediction_request("/api/predict/top1")

    @task(10)  # 权重为10，表示这个任务被选中的频率更高
    def predict_top5(self):
        self._make_prediction_request("/api/predict/top5")

    def _make_prediction_request(self, endpoint):
        # 随机选择一张图片
        image_name = random.choice(IMAGE_FILES)
        image_data = self.loaded_images[image_name]

        files = {"file": (image_name, image_data, "image/jpeg")}

        with self.client.post(endpoint, files=files, catch_response=True) as response:
            if response.status_code == 200:
                json_response = response.json()
                if (
                    json_response.get("success", False)
                    and len(json_response.get("results", [])) > 0
                ):
                    response.success()
                else:
                    response.failure(
                        f"API returned success=false or empty results: {json_response.get('error_message', 'No error message')}"
                    )
            else:
                response.failure(f"Got non-200 status code: {response.status_code}")
