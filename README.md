# 东方主题你画我猜小游戏

本项目是一个为线下活动设计的“你画我猜”互动小游戏。玩家在平板设备上根据题目（东方 Project 角色）进行绘画，系统会实时识别画作并展示给观众，为活动增添趣味性和科技感。

## ✨ 核心功能

- **实时绘画与展示**：玩家在画布页面绘画，内容会实时同步到观众大屏的展示页。
- **AI 实时识别**：后端搭载的深度学习模型会对画布内容进行实时识别，并给出 Top-1 预测结果。
- **游戏流程控制**：管理员拥有独立的控制台页面，可以控制游戏的开始、暂停、重置，并设置倒计时。
- **多阶段结果展示**：游戏倒计时结束前，展示页实时显示 Top-1 结果；倒计时结束后，系统进行最终的 Top-5 精准识别，由管理员决定何时向观众公布。
- **游戏记录与复盘**：每轮游戏的关键数据（画作、识别结果）将被保存，便于回顾和复盘。

## 📂 项目结构详解

为了让所有开发者都能清晰地理解代码的组织方式，这里对项目的主要目录和文件进行详细说明。

```
touhou-draw-guess-game/
├── app/                # 【后端】FastAPI 应用的核心代码
│   ├── api/            # 存放所有 API 路由 (endpoints)
│   │   └── endpoints/
│   │       ├── predict.py      # 模型推理 API
│   │       └── game.py         # 游戏控制 API
│   ├── core/           # 存放核心逻辑与配置
│   │   ├── config.py         # 全局配置，如模型路径
│   │   ├── game_state.py     # 全局游戏状态管理器
│   │   └── topics.py         # 题目加载器
│   ├── models/         # 存放 Pydantic 数据模型，用于 API 的请求和响应
│   │   └── prediction.py     # 预测结果的数据结构
│   ├── utils/          # 通用工具函数
│   │   └── image_processing.py # 图像处理相关函数
│   ├── websocket_manager.py # WebSocket 管理器
│   └── main.py         # FastAPI 应用主入口
│ 
├── frontend/           # 【前端】存放所有静态文件
│   ├── canvas.html     # 画布页面
│   ├── show.html       # 展示页面
│   ├── admin.html      # 控制台页面
│   └── assets/         # 存放 CSS, JavaScript, 图片等资源
│
├── models/             # 存放 AI 模型相关文件
│   ├── touhou_model.onnx # ONNX 格式的模型文件
│   └── class_names.json  # 模型的类别名称列表
│
├── scripts/            # 存放一次性或辅助性的脚本
│   ├── pt2onnx.py      # PyTorch 模型转 ONNX 的脚本
│   └── ...
│
├── tests/              # 存放测试代码
│   └── load_test/      # 简单的负载测试 (使用 Locust)
│
├── history/            # 【自动生成】存放每轮游戏的历史记录
│
├── .gitignore          # 配置 Git 应忽略的文件
├── CONTRIBUTING.md     # Git 协作开发指南
├── README.md           # 你正在阅读的这个文件
├── SETUP.md            # 保姆级环境配置与启动教程
├── TODO.md             # 详细的开发任务清单
└── requirements.txt    # Python 依赖库列表
```

## 🧪 运行与测试指南

### 启动应用

按照 `SETUP.md` 中的教程启动后端服务后，你可以通过以下方式与应用交互：

- **API 交互式文档**:
  打开浏览器访问 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)。这是 FastAPI 自动生成的文档页面，你可以在这里直接测试所有 RESTful API 接口，查看它们的请求参数和响应格式。

- **前端页面**:
  当后端配置好静态文件服务后，你可以直接访问：
  - `http://127.0.0.1:8000/static/canvas.html` (画布页)
  - `http://127.0.0.1:8000/static/show.html` (展示页)
  - `http://127.0.0.1:8000/static/admin.html` (控制台)
  > 注意：URL 路径可能根据最终的静态文件配置而变化。

### 运行负载测试 (可选)

本项目包含一个使用 `locust` 编写的简单负载测试脚本，用于模拟多个用户同时请求模型推理接口。

1.  **安装 Locust**:
    ```bash
    pip install locust
    ```

2.  **运行测试**:
    确保后端服务正在运行，然后在新终端中执行：
    ```bash
    # 进入包含 locustfile.py 的目录
    cd tests/load_test

    # 启动 Locust
    locust
    ```

3.  **打开 Locust Web UI**:
    在浏览器中访问 [http://localhost:8089](http://localhost:8089)。

4.  **开始测试**:
    - **Number of users**: 输入你想模拟的并发用户数。
    - **Spawn rate**: 输入每秒启动多少个用户。
    - **Host**: 输入后端服务地址，即 `http://localhost:8000`。
    - 点击 "Start swarming"，观察 "Charts" 和 "Failures" 标签页，了解服务器在压力下的表现。


## 🚀 快速开始

一份**保姆级**的、从零开始的环境配置与项目启动教程已经为你准备好了！请点击下方链接查看：

➡️ **[查看环境配置与项目启动教程 (SETUP.md)](./SETUP.md)**

---

**对于有经验的开发者，可以参考以下快速指令：**

1.  **克隆仓库**: `git clone <your-repo-url> && cd touhou-draw-guess-game`
2.  **创建并激活虚拟环境**: `python -m venv .venv && .venv\Scripts\activate` (Windows)
3.  **安装依赖**: `pip install -r requirements.txt`
4.  **启动服务**: `uvicorn app.main:app --reload`
5.  **访问 API 文档**: `http://127.0.0.1:8000/docs`


## 🤝 贡献指南

我们欢迎所有团队成员的贡献！为了保持协作的顺畅，我们采用了一套标准的 Git 工作流程。

所有详细的步骤和指南都记录在 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 文件中。在开始你的第一个任务前，请务必花几分钟时间阅读它。

**核心流程摘要**:

1.  **创建分支**: `git checkout -b feature/your-task-name`
2.  **提交代码**: `git commit -m "feat: add some feature"`
3.  **发起合并请求 (Pull Request)**: 在 GitHub / Gitee 上完成。

---
*此 README 由 AI 助手初步生成，待团队成员共同完善。*

