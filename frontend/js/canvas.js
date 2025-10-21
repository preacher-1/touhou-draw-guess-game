/* canvas.js
   说明：
   - 橡皮不再尝试用 destination-out 做像素级擦除（该实现对部分 fabric 版本或浏览器存在兼容性问题）
   - 改为把画笔颜色设为画布背景色（默认白色），以“覆盖”方式实现擦除效果（兼容性高）
   - 历史（undo/redo）逻辑保留，橡皮操作会入栈，可撤销/重做
   - 油漆桶功能采用“栅格化”方案实现
*/

(function () {
	// ========= 配置区（不要修改 WebSocket 地址构造策略） =========
	const WS_URL =
		(window.location.protocol === "https:" ? "wss://" : "ws://") +
		window.location.host +
		"/ws/canvas";
	const HEARTBEAT_INTERVAL = 30000;
	const UPLOAD_DEBOUNCE_MS = 400;
	const MAX_SIDE = 512;

	// ========= 状态变量 =========
	let socket = null;
	let heartbeatTimer = null;
	let reconnectTimer = null;

	let fabricCanvas = null;

	// history 管理：stack + index
	let historyStack = [];
	let historyIndex = -1;
	const HISTORY_LIMIT = 100;

	// 当前画笔颜色 & 是否橡皮 & 是否油漆桶
	let currentColor = "#000000";
	let isEraserMode = false;
	let isFillMode = false;

	// 上传防抖
	let uploadDebounceTimer = null;

	// ========== 通用工具函数 ==========
	function debounce(fn, ms) {
		let t = null;
		return function (...args) {
			if (t) clearTimeout(t);
			t = setTimeout(() => fn.apply(this, args), ms);
		};
	}

	function dataURLResize(dataURL, maxSide, callback) {
		const img = new Image();
		img.onload = function () {
			const ratio = Math.min(
				maxSide / img.width,
				maxSide / img.height,
				1
			);
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(img.width * ratio);
			canvas.height = Math.round(img.height * ratio);
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			callback(canvas.toDataURL("image/png"));
		};
		img.src = dataURL;
	}

	/**
	 * @description 泛洪填充（油漆桶）核心算法
	 * @param {CanvasRenderingContext2D} ctx - 临时2D画布的上下文
	 * @param {number} startX - 用户点击的X坐标
	 * @param {number} startY - 用户点击的Y坐标
	 * @param {Array<number>} fillColor - 填充色 [R, G, B, A]
	 * @param {number} tolerance - 颜色容差 (0-255)，用于处理抗锯齿边缘
	 */
	function floodFill(ctx, startX, startY, fillColor, tolerance = 5) {
		console.log(
			`[油漆桶] 开始填充，位置: (${startX}, ${startY}), 颜色: ${fillColor}, 容差: ${tolerance}`
		);
		const imageData = ctx.getImageData(
			0,
			0,
			ctx.canvas.width,
			ctx.canvas.height
		);
		const { data, width, height } = imageData;
		const stack = [[startX, startY]];
		const startIndex = (startY * width + startX) * 4;

		// 检查点击坐标是否有效（防止索引越界）
		if (startIndex < 0 || startIndex >= data.length) {
			console.warn("[油漆桶] 点击坐标无效或越界。");
			return;
		}

		const startColor = [
			data[startIndex],
			data[startIndex + 1],
			data[startIndex + 2],
			data[startIndex + 3],
		];

		// 如果点击的颜色和填充色一样，则不进行任何操作
		if (
			Math.abs(startColor[0] - fillColor[0]) <= tolerance &&
			Math.abs(startColor[1] - fillColor[1]) <= tolerance &&
			Math.abs(startColor[2] - fillColor[2]) <= tolerance
		) {
			console.log("[油漆桶] 目标颜色与填充色相同，操作取消。");
			return;
		}

		const visited = new Uint8Array(width * height);

		while (stack.length > 0) {
			const [x, y] = stack.pop();

			// 检查坐标合法性
			if (x < 0 || x >= width || y < 0 || y >= height) continue;

			const index = (y * width + x) * 4;

			if (visited[y * width + x]) continue;
			visited[y * width + x] = 1;

			const r = data[index];
			const g = data[index + 1];
			const b = data[index + 2];

			if (
				Math.abs(r - startColor[0]) <= tolerance &&
				Math.abs(g - startColor[1]) <= tolerance &&
				Math.abs(b - startColor[2]) <= tolerance
			) {
				data[index] = fillColor[0];
				data[index + 1] = fillColor[1];
				data[index + 2] = fillColor[2];
				data[index + 3] = fillColor[3];

				if (x > 0) stack.push([x - 1, y]);
				if (x < width - 1) stack.push([x + 1, y]);
				if (y > 0) stack.push([x, y - 1]);
				if (y < height - 1) stack.push([x, y + 1]);
			}
		}
		ctx.putImageData(imageData, 0, 0);
		console.log("[油漆桶] 填充算法执行完毕。");
	}

	function expandFill(ctx, color, expand = 1) {
		const w = ctx.canvas.width;
		const h = ctx.canvas.height;
		const img = ctx.getImageData(0, 0, w, h);
		const data = img.data;

		// 1. 建立 mask：填充过的地方 α=255 且颜色等于目标色
		const mask = new Uint8Array(w * h);
		const [r, g, b] = color;
		for (let i = 0; i < data.length; i += 4) {
			const idx = i / 4;
			if (
				data[i] === r &&
				data[i + 1] === g &&
				data[i + 2] === b &&
				data[i + 3] === 255
			) {
				mask[idx] = 1;
			}
		}

		// 2. 扩张 mask 1 px（四连通）
		const tmp = new Uint8Array(mask);
		for (let y = 1; y < h - 1; y++) {
			for (let x = 1; x < w - 1; x++) {
				const i = y * w + x;
				if (tmp[i]) continue;
				// 上下左右有填充则扩张
				if (tmp[i - 1] || tmp[i + 1] || tmp[i - w] || tmp[i + w]) {
					mask[i] = 1;
				}
			}
		}

		// 3. 把扩张后的 mask 刷成目标色
		for (let i = 0; i < mask.length; i++) {
			if (mask[i]) {
				data[i * 4] = r;
				data[i * 4 + 1] = g;
				data[i * 4 + 2] = b;
				data[i * 4 + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	// ========= WebSocket（保留原逻辑） =========
	function connectWebSocket() {
		socket = new WebSocket(WS_URL);

		socket.addEventListener("open", () => {
			console.log("[WS] connected");
			sendMessage({
				type: "hello",
				client: "canvas",
				timestamp: Date.now(),
			});
			startHeartbeat();
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
		});

		socket.addEventListener("message", (ev) => {
			let msg = null;
			try {
				msg = JSON.parse(ev.data);
			} catch (e) {
				console.warn("[WS] invalid json", ev.data);
				return;
			}
			handleServerMessage(msg);
		});

		socket.addEventListener("close", (ev) => {
			console.warn("[WS] closed", ev);
			stopHeartbeat();
			scheduleReconnect();
		});

		socket.addEventListener("error", (ev) => {
			console.error("[WS] error", ev);
			socket.close();
		});
	}

	function scheduleReconnect() {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			console.log("[WS] attempting reconnect...");
			connectWebSocket();
		}, 2000 + Math.random() * 3000);
	}

	function startHeartbeat() {
		if (heartbeatTimer) clearInterval(heartbeatTimer);
		heartbeatTimer = setInterval(() => {
			if (socket && socket.readyState === WebSocket.OPEN)
				sendMessage({ type: "ping", timestamp: Date.now() });
		}, HEARTBEAT_INTERVAL);
	}

	function stopHeartbeat() {
		if (heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
	}

	function sendMessage(obj) {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify(obj));
	}

	function handleServerMessage(msg) {
		// 仅作日志转发（保留原有处理口）
		switch (msg.type) {
			case "welcome":
			case "broadcast_canvas":
			case "game_state":
			case "command":
			case "error":
				console.log("[WS] message", msg);
				break;
			default:
				console.log("[WS] unknown message", msg);
		}
	}

	// ========= 历史（history）管理 ==========
	function pushStateToHistory(label = "操作") {
		try {
			if (historyIndex < historyStack.length - 1) {
				historyStack = historyStack.slice(0, historyIndex + 1);
			}
			const json = fabricCanvas.toJSON();
			historyStack.push({ json: json, label: label, time: new Date() });
			if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
			else historyIndex++;
			if (historyIndex >= historyStack.length)
				historyIndex = historyStack.length - 1;
			renderHistoryPanel();
		} catch (e) {
			console.error("[历史] push 失败", e);
		}
	}

	function canUndo() {
		return historyIndex > 0;
	}
	function canRedo() {
		return historyIndex < historyStack.length - 1;
	}

	function undo() {
		if (!canUndo()) return;
		historyIndex--;
		const state = historyStack[historyIndex].json;
		fabricCanvas.loadFromJSON(state, function () {
			fabricCanvas.renderAll(); // 1. 渲染画布
			renderHistoryPanel(); // 2. 刷新历史UI
			triggerUpload("undo"); // 3. 上传
		});
		addHistoryLog("撤销");
	}

	function redo() {
		if (!canRedo()) return;
		historyIndex++;
		const state = historyStack[historyIndex].json;
		fabricCanvas.loadFromJSON(state, function () {
			fabricCanvas.renderAll(); // 1. 渲染画布
			renderHistoryPanel(); // 2. 刷新历史UI
			triggerUpload("redo"); // 3. 上传
		});
		addHistoryLog("重做");
	}

	// 可视化历史面板（方块化）
	function renderHistoryPanel() {
		const container = document.getElementById("history-list");
		if (!container) return;
		container.innerHTML = "";
		for (let i = historyStack.length - 1; i >= 0; i--) {
			const entry = historyStack[i];
			const node = document.createElement("div");
			node.className = "history-item-box";
			node.setAttribute("data-index", i);
			node.title = `${entry.label} — ${entry.time.toLocaleTimeString()}`;

			const text = document.createElement("div");
			text.className = "history-item-text";
			text.textContent = entry.label;
			node.appendChild(text);

			if (i > historyIndex) node.classList.add("history-item-future");
			else if (i === historyIndex)
				node.classList.add("history-item-current");
			else node.classList.add("history-item-past");

			(function (idx) {
				node.addEventListener("click", function () {
					historyIndex = idx;
					const state = historyStack[historyIndex].json;
					fabricCanvas.loadFromJSON(
						state,
						fabricCanvas.renderAll.bind(fabricCanvas),
						function () {
							renderHistoryPanel();
							triggerUpload("jump_history");
							addHistoryLog(
								`跳转历史: ${historyStack[historyIndex].label}`
							);
						}
					);
				});
			})(i);

			container.appendChild(node);
		}
	}

	function addHistoryLog(text) {
		const time = new Date().toLocaleTimeString();
		console.log(`[操作] ${time} - ${text}`);
	}

	// ========= 上传节流 ==========
	function triggerUpload(last_action = "auto") {
		if (uploadDebounceTimer) clearTimeout(uploadDebounceTimer);
		uploadDebounceTimer = setTimeout(() => {
			uploadCanvas(last_action);
		}, UPLOAD_DEBOUNCE_MS);
	}

	function uploadCanvas(last_action = "auto") {
		if (!fabricCanvas) return;
		const dataURL = fabricCanvas.toDataURL({ format: "png" });
		dataURLResize(dataURL, MAX_SIDE, (smallDataURL) => {
			sendMessage({
				type: "canvas_update",
				round: getRoundInputValue(),
				data_url: smallDataURL,
				last_action: last_action,
				timestamp: Date.now(),
			});
		});
	}

	function getRoundInputValue() {
		const el = document.getElementById("round-input");
		if (!el) return 1;
		const v = parseInt(el.value, 10);
		return isNaN(v) ? 1 : v;
	}

	// ========= 颜色 / 橡皮 / 油漆桶 管理 ==========
	// setBrushColor：设置画笔颜色，并确保退出橡皮/油漆桶模式
	function setBrushColor(color) {
		currentColor = color;
		// 选择颜色时自动退出特殊模式（常见交互）
		isEraserMode = false;
		isFillMode = false;
		if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
			fabricCanvas.isDrawingMode = true; // 确保恢复绘画模式
			fabricCanvas.freeDrawingBrush.color = color;
			try {
				fabricCanvas.freeDrawingBrush.globalCompositeOperation =
					"source-over";
			} catch (e) {
				/* ignore */
			}
		}
		updateColorSwatchUI(color);
		updateEraserUI(false);
		updateFillUI(false);
	}

	// 把画笔颜色设置为画布背景色（实现“覆盖式橡皮”）
	function setEraserMode() {
		isEraserMode = true;
		isFillMode = false; // 退出油漆桶
		if (!fabricCanvas || !fabricCanvas.freeDrawingBrush) {
			updateEraserUI(true);
			return;
		}

		fabricCanvas.isDrawingMode = true; // 确保是绘画模式

		const bg = "#ffffff";
		try {
			fabricCanvas.freeDrawingBrush.color = bg;
			fabricCanvas.freeDrawingBrush.globalCompositeOperation =
				"source-over";
		} catch (e) {
			console.warn("[橡皮] 无法设置 brush 属性，继续尝试以背景色覆盖", e);
			try {
				fabricCanvas.freeDrawingBrush.color = bg;
			} catch (ee) {
				/* ignore */
			}
		}
		updateEraserUI(true);
		updateFillUI(false); // 进入橡皮模式时退出油漆桶模式
	}

	// 恢复画笔模式（将颜色恢复为用户选择的颜色）
	function restoreBrushMode() {
		isEraserMode = false;
		isFillMode = false;
		if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
			fabricCanvas.isDrawingMode = true; // 确保是绘画模式
			try {
				fabricCanvas.freeDrawingBrush.globalCompositeOperation =
					"source-over";
			} catch (e) {
				/* ignore */
			}
			fabricCanvas.freeDrawingBrush.color = currentColor;
		}
		updateEraserUI(false);
		updateFillUI(false);
	}

	// 进入油漆桶模式
	function setFillMode() {
		isFillMode = true;
		isEraserMode = false; // 退出橡皮模式
		if (fabricCanvas) {
			fabricCanvas.isDrawingMode = false; // 退出自由绘画 (关键)
		}
		updateFillUI(true);
		updateEraserUI(false);
		addHistoryLog("切换到油漆桶模式");
	}

	// 恢复画笔模式（从油漆桶模式）
	function restoreBrushModeFromFill() {
		isFillMode = false;
		if (fabricCanvas) {
			fabricCanvas.isDrawingMode = true; // 恢复自由绘画
		}
		updateFillUI(false);
		addHistoryLog("恢复画笔（从油漆桶）");
	}

	// UI：颜色 swatch 的 active 同步
	function updateColorSwatchUI(color) {
		const swatches = document.querySelectorAll(".color-swatch");
		swatches.forEach((s) => {
			if (
				s.dataset &&
				s.dataset.color &&
				s.dataset.color.toLowerCase() === color.toLowerCase()
			)
				s.classList.add("active");
			else s.classList.remove("active");
		});
		const colorInput = document.getElementById("brush-color");
		if (colorInput) colorInput.value = color;

		// 如果当前是橡皮模式或油漆桶模式，选择颜色意味着恢复画笔
		if (isEraserMode) restoreBrushMode();
		if (isFillMode) restoreBrushModeFromFill();
	}

	function updateEraserUI(active) {
		const eraserBtn = document.getElementById("eraser-btn");
		if (!eraserBtn) return;
		if (active) eraserBtn.classList.add("active");
		else eraserBtn.classList.remove("active");
	}

	// 此函数用于处理光标和对象选择性
	function updateFillUI(active) {
		const fillBtn = document.getElementById("fill-btn");
		if (!fillBtn) return;

		if (active) {
			fillBtn.classList.add("active");
			if (fabricCanvas) {
				// 禁用对象选择，防止光标变为“移动”
				fabricCanvas.selection = false;
				fabricCanvas.defaultCursor = "crosshair";
				// 强制悬停光标也为 'crosshair'
				fabricCanvas.hoverCursor = "crosshair";
				// 遍历所有对象，使其不可选中
				fabricCanvas.forEachObject((o) => o.set("selectable", false));
				fabricCanvas.renderAll();
			}
		} else {
			fillBtn.classList.remove("active");
			if (fabricCanvas) {
				// 恢复对象选择
				fabricCanvas.selection = true;
				fabricCanvas.defaultCursor = "default";
				// 恢复悬停光标
				fabricCanvas.hoverCursor = "move";
				// 恢复对象的可选性
				fabricCanvas.forEachObject((o) => o.set("selectable", true));
				fabricCanvas.renderAll();
			}
		}
		// 注意：fabricCanvas.isDrawingMode 由 setFillMode 和 restoreBrushModeFromFill 控制
	}

	// ========= 初始化 Fabric.js ==========
	function initFabricCanvas() {
		fabricCanvas = new fabric.Canvas("main-canvas", {
			isDrawingMode: true,
			backgroundColor: "#ffffff",
			width: window.innerWidth - 300,
			height: window.innerHeight - 60,
			preserveObjectStacking: true,
		});

		// 使用 PencilBrush（常见且稳定）
		fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
		fabricCanvas.freeDrawingBrush.width = 6;
		fabricCanvas.freeDrawingBrush.color = currentColor;
		fabricCanvas.freeDrawingBrush.globalCompositeOperation = "source-over";

		// 绘制完成时（path:created）-- 非橡皮与橡皮都做历史入栈
		fabricCanvas.on("path:created", function (opt) {
			try {
				if (isEraserMode) {
					pushStateToHistory("橡皮擦");
					renderHistoryPanel();
					triggerUpload("erase");
				} else {
					pushStateToHistory("绘制路径");
					renderHistoryPanel();
					triggerUpload("draw");
				}
			} catch (e) {
				console.error("[path:created] 历史入栈失败", e);
			}
		});

		// 油漆桶点击事件
		fabricCanvas.on("mouse:down", function (options) {
			if (!isFillMode) return;

			// 阻止 fabric 默认的选择/拖拽行为
			if (options.target) {
				options.e.preventDefault();
			}

			console.log("[油漆桶] 检测到点击事件（栅格化方案）");
			const pointer = fabricCanvas.getPointer(options.e);
			const x = Math.round(pointer.x);
			const y = Math.round(pointer.y);

			// (步骤 1: 强制渲染最新状态)
			try {
				fabricCanvas.renderAll();
			} catch (e) {
				console.error("[油漆桶] 步骤 1: renderAll 失败", e);
				return;
			}

			// (步骤 2: "栅格化" - 获取包含所有对象和背景的 DataURL)
			const currentDataURL = fabricCanvas.toDataURL({ format: "png" });

			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = fabricCanvas.width;
			tempCanvas.height = fabricCanvas.height;
			const tempCtx = tempCanvas.getContext("2d", {
				willReadFrequently: true,
			});

			// (步骤 3: 将栅格化图像加载到临时画布)
			const img = new Image();
			img.onload = function () {
				// 3a. 绘制到临时画布
				tempCtx.drawImage(
					img,
					0,
					0,
					tempCanvas.width,
					tempCanvas.height
				);

				// 3b. 准备填充色
				const colorToFill =
					fabric.Color.fromHex(currentColor).getSource(); // [R, G, B, A]
				colorToFill[3] = Math.round(colorToFill[3] * 255);

				try {
					// 检查坐标是否越界
					if (
						x < 0 ||
						x >= tempCanvas.width ||
						y < 0 ||
						y >= tempCanvas.height
					) {
						console.warn("[油漆桶] 点击坐标超出画布范围");
						return;
					}
					// (步骤 4: 在临时画布上执行泛洪填充)
					floodFill(tempCtx, x, y, colorToFill);
					expandFill(tempCtx, colorToFill, 1); // 扩展填充
				} catch (e) {
					console.error("[油漆桶] 步骤 4: 泛洪填充算法失败", e);
					return;
				}

				// (步骤 5: 获取填充后的新图像)
				const newBgDataUrl = tempCanvas.toDataURL();

				// (步骤 6: 将新图像设置为 Fabric 的背景)
				fabric.Image.fromURL(newBgDataUrl, (filledImg) => {
					// (步骤 7: 关键 - 在 setBackgroundImage 的回调中执行清空和历史记录)
					fabricCanvas.setBackgroundImage(
						filledImg,
						function () {
							// 7a. 清空所有旧的矢量对象（只清除对象，保留背景图）
							// 遍历并移除所有 Fabric 对象
							const allObjects = fabricCanvas.getObjects();
							allObjects.forEach((obj) => {
								fabricCanvas.remove(obj);
							});

							fabricCanvas.backgroundColor = "transparent"; // 背景已是图片

							// 7b. (记录历史)
							pushStateToHistory("油漆桶填充");
							triggerUpload("fill");
							console.log(
								"[油漆桶] 步骤 7: 操作完成并已记录历史。"
							);

							// 7c. 渲染最终状态
							fabricCanvas.renderAll();
						},
						{
							// 背景图选项
							originX: "left",
							originY: "top",
						}
					);
				});
			};

			img.onerror = function () {
				console.error("[油漆桶] 步骤 3: 无法加载画布 DataURL 截图");
			};

			img.src = currentDataURL;
		});

		// 对象修改事件（例如移动/缩放/旋转）入栈
		fabricCanvas.on("object:modified", function () {
			pushStateToHistory("修改对象");
			renderHistoryPanel();
			triggerUpload("modify");
		});

		// 把初始空白状态入栈（保证第一次撤销可以回到空白）
		(function pushInitial() {
			try {
				const json = fabricCanvas.toJSON();
				historyStack = [
					{ json: json, label: "初始画布", time: new Date() },
				];
				historyIndex = 0;
				renderHistoryPanel();
			} catch (e) {
				console.error("[历史] 初始状态入栈失败", e);
			}
		})();

		// 窗口尺寸变化时调整 canvas 大小
		window.addEventListener("resize", function () {
			fabricCanvas.setDimensions({
				width: window.innerWidth - 300,
				height: window.innerHeight - 60,
			});
		});
	}

	// ========= 初始化颜色选择器 & 工具按钮 ==========
	function initColorPickerAndTools() {
		const swatches = document.querySelectorAll(".color-swatch");
		const colorInput = document.getElementById("brush-color");

		swatches.forEach((swatch) => {
			swatch.addEventListener("click", () => {
				const color = swatch.dataset.color;
				setBrushColor(color);
				addHistoryLog(`选择颜色 ${color}`);
			});
		});

		if (colorInput) {
			colorInput.addEventListener("input", function () {
				const color = colorInput.value;
				setBrushColor(color);
				addHistoryLog(`自选颜色 ${color}`);
			});
		}

		// 工具按钮：撤销 / 重做 / 重置 / 橡皮 / 保存
		const undoBtn = document.getElementById("undo-btn");
		const redoBtn = document.getElementById("redo-btn");
		const resetBtn = document.getElementById("reset-btn");
		const eraserBtn = document.getElementById("eraser-btn");
		const fillBtn = document.getElementById("fill-btn");
		const downloadBtn = document.getElementById("download-btn");

		if (undoBtn) undoBtn.addEventListener("click", () => undo());
		if (redoBtn) redoBtn.addEventListener("click", () => redo());

		if (resetBtn) {
			resetBtn.addEventListener("click", function () {
				// === 1. 重置画布 ===
				fabricCanvas.clear();
				fabricCanvas.backgroundColor = "#ffffff";
				const json = fabricCanvas.toJSON();
				historyStack = [
					{ json: json, label: "初始画布", time: new Date() },
				];
				historyIndex = 0;
				renderHistoryPanel();
				triggerUpload("reset");
				addHistoryLog("重置画布");

				// === 2. 重置工具 ===

				// 2a. 定义默认值
				const defaultColor = "#000000";
				const defaultSize = 6;

				// 2b. 重置颜色 (这将自动退出橡皮/油漆桶模式)
				setBrushColor(defaultColor);

				// 2c. 重置笔刷大小 (手动更新UI和 fabric 实例)
				try {
					const sizeRange = document.getElementById("brush-size");
					const previewDot =
						document.getElementById("brush-preview-dot");

					if (sizeRange) {
						sizeRange.value = defaultSize;
					}
					if (previewDot) {
						previewDot.style.width = `${defaultSize}px`;
						previewDot.style.height = `${defaultSize}px`;
					}
					if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
						fabricCanvas.freeDrawingBrush.width = defaultSize;
					}
				} catch (e) {
					console.error("[重置] 无法重置笔刷大小", e);
				}
			});
		}

		if (eraserBtn) {
			eraserBtn.addEventListener("click", function () {
				if (!isEraserMode) {
					setEraserMode();
					addHistoryLog("切换到橡皮擦（背景色覆盖）");
				} else {
					restoreBrushMode();
					addHistoryLog("恢复画笔");
				}
			});
		}

		if (fillBtn) {
			fillBtn.addEventListener("click", function () {
				if (!isFillMode) {
					setFillMode();
				} else {
					restoreBrushModeFromFill();
				}
			});
		}

		if (downloadBtn) {
			downloadBtn.addEventListener("click", function () {
				const dataURL = fabricCanvas.toDataURL({ format: "png" });
				const a = document.createElement("a");
				a.href = dataURL;
				const now = new Date();
				const timestamp = now
					.toISOString()
					.slice(0, 19)
					.replace(/[-:]/g, "")
					.replace("T", "_");
				a.download = `touhou_canvas_${timestamp}.png`;
				a.click();
				addHistoryLog("保存画布");
			});
		}

		// 笔刷大小同步与预览
		const sizeRange = document.getElementById("brush-size");
		const previewDot = document.getElementById("brush-preview-dot");
		if (sizeRange && previewDot) {
			const updateBrushSize = (size) => {
				if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
					fabricCanvas.freeDrawingBrush.width = size;
				}
				previewDot.style.width = `${size}px`;
				previewDot.style.height = `${size}px`;
				console.log(`[笔刷] 大小调整为: ${size}`);
			};

			sizeRange.addEventListener("input", function (e) {
				const size = parseInt(e.target.value, 10);
				updateBrushSize(size);
			});

			// 初始化预览
			updateBrushSize(parseInt(sizeRange.value, 10));
		}
	}

	// ========= 主初始化函数（暴露到 window） ==========
	function init() {
		initFabricCanvas();
		initColorPickerAndTools();
		// NOTE: WebSocket 连接是否需要启用由你当前项目决定；原文件中可能调用 connectWebSocket()
		// 如果你希望启用 websocket，请把下一行取消注释：
		// connectWebSocket();
		console.log("[系统] 画布模块初始化完成");
	}

	window.canvasModuleInit = init;
})();
