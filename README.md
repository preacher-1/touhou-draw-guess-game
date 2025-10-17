# 东方主题你画我猜小游戏

本项目是一个为线下活动设计的“你画我猜”互动小游戏。玩家在平板设备上根据题目（东方 Project 角色）进行绘画，系统会实时识别画作并展示给观众，为活动增添趣味性和科技感。

## ✨ 核心功能

- **实时绘画与展示**：玩家在画布页面绘画，内容会实时同步到观众大屏的展示页。
- **AI 实时识别**：后端搭载的深度学习模型会对画布内容进行实时识别，并给出 Top-1 预测结果。
- **游戏流程控制**：管理员拥有独立的控制台页面，可以控制游戏的开始、暂停、重置，并设置倒计时。
- **多阶段结果展示**：游戏倒计时结束前，展示页实时显示 Top-1 结果；倒计时结束后，系统进行最终的 Top-5 精准识别，由管理员决定何时向观众公布。
- **游戏记录与复盘**：每轮游戏的关键数据（画作、识别结果）将被保存，便于回顾和复盘。

## 📂 项目结构

```
touhou-draw-guess-game/
├── app/                # FastAPI 后端应用
│   ├── api/            # API 路由端点 (e.g., predict)
│   ├── core/           # 核心配置 (e.g., settings)
│   ├── models/         # Pydantic 数据模型 (e.g., prediction results)
│   └── utils/          # 工具函数 (e.g., image processing)
├── frontend/           # 前端静态文件 (HTML, CSS, JavaScript)
├── models/             # 存放 ONNX 模型文件和类别名称
├── scripts/            # 辅助脚本 (e.g., 模型转换)
├── tests/              # 测试代码 (e.g., 负载测试)
├── .gitignore          # Git 忽略文件配置
├── README.md           # 项目说明文档
└── requirements.txt    # Python 依赖库
```

## 🚀 快速开始 (初版)

> **注意**: 详细的环境配置和部署教程将在后续文档中提供。

1.  **克隆仓库**
    ```bash
    git clone <your-repo-url>
    cd touhou-draw-guess-game
    ```

2.  **创建虚拟环境并安装依赖**
    ```bash
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # macOS/Linux
    # source .venv/bin/activate

    pip install -r requirements.txt
    ```

3.  **启动后端服务**
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

4.  **访问应用**
    - **后端 API 文档**: [http://localhost:8000/docs](http://localhost:8000/docs)
    - **前端页面**: (待定, 部署后访问)

## 🤝 贡献指南 (初版)

为保证代码质量和协作效率，请遵循以下基本流程：

1.  **创建特性分支**: 从 `main` 分支创建新的特性分支，命名建议为 `feature/xxx` 或 `fix/xxx`。
    ```bash
    git checkout -b feature/canvas-page
    ```
2.  **提交代码**: 完成开发后，清晰地提交你的代码。
    ```bash
    git add .
    git commit -m "feat: 完成画布页面基础布局"
    ```
3.  **发起合并请求 (Pull Request)**: 将你的分支推送到远程仓库，并创建一个指向 `main` 分支的 Pull Request。

---
*此 README 由 AI 助手初步生成，待团队成员共同完善。*

