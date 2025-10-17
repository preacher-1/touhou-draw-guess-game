# 项目开发任务清单 (高级)

这是一个高级别的任务清单，用于跟踪项目的主要开发模块。详细的子任务将在后续步骤中拆解。

## 核心模块

- [ ] **前端：画布页面 (`/canvas`)** - 供玩家进行绘画创作。
- [ ] **前端：展示页面 (`/show`)** - 面向观众，实时展示画作和识别结果。
- [ ] **前端：控制台页面 (`/admin`)** - 供管理员控制游戏流程。
- [x] **后端：模型推理 API (`/predict`)** - 已完成核心推理功能。
- [ ] **后端：游戏逻辑 API** - 用于管理游戏状态、轮次、倒计时等。

---

# 系统架构设计图 (草案)

```mermaid
graph TB
    subgraph A["A. 画布页 (/canvas)"]
        direction LR
        A1(笔刷/颜色/橡皮) --> A5
        A4(清空/撤销/重做) --> A5
        A5[画布]
    end

    subgraph B["B. 展示页 (/show)"]
        direction LR
        B1[画作展示区]
        B2[实时识别结果 (Top-1)]
        B3[游戏信息 (轮次/倒计时)]
    end

    subgraph C["C. 控制台 (/admin)"]
        direction LR
        C1(游戏控制<br>开始/暂停/重置)
        C2(倒计时设置)
        C3(结果控制<br>显示/隐藏Top-5)
        C4[状态监控<br>画布/模型/游戏状态]
    end

    subgraph D["D. 后端服务"]
        direction TD
        D1[FastAPI 应用]
        D2(游戏状态管理 API)
        D3(实时通信 WebSocket)
        D4(模型推理 API<br>/predict/top1, /predict/top5)
    end

    %% 数据流
    A5 -- "画布数据 (WebSocket)" --> D3
    D3 -- "同步画布" --> B1
    D3 -- "发送至模型" --> D4
    D4 -- "Top-1 结果" --> D3
    D3 -- "更新实时结果" --> B2

    %% 控制流
    C1 & C2 & C3 -- "HTTP 请求" --> D2
    D2 -- "更新游戏状态 (WebSocket)" --> D3
    D3 -- "更新游戏信息" --> B3
    D3 -- "控制结果显示" --> B2

    %% 页面访问
    Player([玩家<br>iPad/PC]) --> A
    Audience([观众<br>大屏幕]) --> B
    Admin([管理员<br>PC/Laptop]) --> C

    %% 图例
    subgraph Legend["图例"]
        direction LR
        L1(控件/操作)
        L2[显示区域]
        L3[后端模块]
        L4([用户角色])
    end
    style Legend fill:none,stroke:#ccc,stroke-dasharray: 5 5
```
