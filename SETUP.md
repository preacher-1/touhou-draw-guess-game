# 环境配置与项目启动教程

本教程将一步步指导你如何从零开始，在你的电脑上成功配置好开发环境并运行本项目。

## 0. 准备工作：安装基础软件

在开始之前，请确保你的电脑上已经安装了以下两个基础软件：

1.  **Git**: 一个版本控制工具，用于下载和管理代码。
    *   下载链接：https://git-scm.com/downloads
    *   安装时一路点击“下一步”即可。安装完成后，在终端（或命令提示符）输入 `git --version`，如果能显示版本号，说明安装成功。

2.  **Python**: 本项目的后端编程语言。
    *   **强烈建议安装 Python 3.10 或 3.11 版本**，以保证最好的兼容性。
    *   下载链接：https://www.python.org/downloads/
    *   **Windows 用户请注意**：在安装时，务必勾选 **"Add Python to PATH"** 选项！
    *   安装完成后，在终端输入 `python --version` 或 `python3 --version`，如果能显示版本号，说明安装成功。

3. **VS Code**: 一个强大的代码编辑器，用于编写和调试代码。
   
---

## 1. 获取项目代码

首先，你需要将项目代码从远程仓库（如 GitHub/Gitee）克隆到你的本地电脑上。

```bash
# 打开你的终端 (Terminal) 或 PowerShell
# 将 <your-repo-url> 替换为项目的实际 Git 地址
git clone <your-repo-url>

# 进入项目目录
cd touhou-draw-guess-game
```

---

## 2. 创建并激活 Python 虚拟环境

为了避免和你电脑上其他 Python 项目产生依赖冲突，我们需要为本项目创建一个独立的“虚拟环境”。

> **什么是虚拟环境？**
>
> 想象一下，你为这个项目创建了一个专属的、干净的“Python 工具箱”（就是虚拟环境）。之后，我们所有需要的工具（依赖库）都只安装在这个箱子里，而不会弄乱你系统全局的工具箱。

### 推荐：使用 VS Code 创建虚拟环境

如果你使用的是 VS Code，你可以直接在 VS Code 中创建和激活虚拟环境。
使用 VS Code 需要先安装一些插件，可以参考：
- VS Code 配置：https://www.runoob.com/python3/python-vscode-setup.html
- Python 开发环境配置：https://www.runoob.com/vscode/vscode-extensions-chinese.html
- pip 相关配置：https://www.runoob.com/w3cnote/python-pip-install-usage.html

在 VS Code 中打开项目文件夹，随后点击最上方的搜索框，输入 `> Python: Select Interpreter`（不区分大小写），选择创建虚拟环境 `Python: Create Virtual Environment`，选择之前安装的 Python 版本，随后理论上会提示安装requirements.txt的依赖。

在 VS Code 中，通过 `Ctrl + ~` 快捷键可以打开终端，如果创建了虚拟环境，打开终端时应当会自动启用虚拟环境。

### 对于 Windows 用户 (使用 PowerShell):

```powershell
# 在项目根目录下，运行以下命令创建一个名为 .venv 的虚拟环境
python -m venv .venv

# 激活这个虚拟环境
.venv\Scripts\Activate.ps1
```
> **提示**: 如果 `Activate.ps1` 执行失败，提示“无法加载文件...因为在此系统上禁止运行脚本”，请以**管理员身份**打开一个新的 PowerShell，执行 `Set-ExecutionPolicy Unrestricted`，输入 `Y` 并回车。然后关闭管理员 PowerShell，回到普通终端重试激活命令。

### 对于 macOS 或 Linux 用户:

```bash
# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate
```

**如何判断是否成功？**
激活成功后，你的终端命令行前面会出现 `(.venv)` 的字样，像这样：
`(.venv) D:\PycharmProjects\touhou-draw-guess-game>`
这表示你已经进入了这个项目的专属“Python 工具箱”，之后所有的 `pip` 操作都将只影响这个环境。

---

## 3. 安装项目依赖

现在，我们来安装这个项目所需要的所有第三方库。
**如果你前面使用了 VS Code，那么理论上这一步可以跳过。**

```bash
# 确保你已经激活了虚拟环境（命令行前面有 .venv）
# 使用 pip 工具读取 requirements.txt 文件并自动安装所有依赖
pip install -r requirements.txt

# 如果下载失败，切换至国内镜像源或使用代理
# 设置全局镜像源
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
# 阿里源
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
# 清华源
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/
```
这个过程可能会持续几分钟，具体时间取决于你的网络速度。请耐心等待它完成。

---

## 4. 启动后端服务

万事俱备！现在我们可以启动项目的 FastAPI 后端服务了。

```bash
# 确保你在项目的根目录下
# 运行以下命令启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*   `app.main:app`: 指的是启动 `app/main.py` 文件中的 `app` 实例。
*   `--host 0.0.0.0`: 让局域网内的其他设备（如手机、iPad）也能访问你的服务。
*   `--port 8000`: 指定服务运行在 8000 端口。
*   `--reload`: 这是一个非常有用的开发模式。当你的 Python 代码有任何改动并保存后，服务会自动重启，无需你手动操作。

---

## 5. 验证是否成功

当终端显示类似以下信息时，说明后端服务已成功启动：
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxx] using statreload
INFO:     Started server process [xxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

现在，打开你的浏览器，访问 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)。

如果你能看到一个标题为 "FastAPI - Swagger UI" 的页面，并且其中列出了项目的 API（比如 `/predict`），那么恭喜你，你已经成功在本地运行了整个项目！

---

**如何停止服务？**
在运行 `uvicorn` 命令的终端窗口中，按下 `Ctrl + C` 即可停止服务。

**如何退出虚拟环境？**
当你完成了今天的工作，想退出虚拟环境时，只需在终端输入：
```bash
deactivate
```
