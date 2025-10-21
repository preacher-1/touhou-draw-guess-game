/* canvas.js
   说明：
   - 橡皮不再尝试用 destination-out 做像素级擦除（该实现对部分 fabric 版本或浏览器存在兼容性问题）
   - 改为把画笔颜色设为画布背景色（默认白色），以“覆盖”方式实现擦除效果（兼容性高）
   - 历史（undo/redo）逻辑保留，橡皮操作会入栈，可撤销/重做
   - 未改动 WebSocket 相关函数（保留原样）
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

	// 当前画笔颜色 & 是否橡皮
	let currentColor = "#000000";
	let isEraserMode = false;

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
		fabricCanvas.loadFromJSON(
			state,
			fabricCanvas.renderAll.bind(fabricCanvas),
			function () {
				renderHistoryPanel();
				triggerUpload("undo");
			}
		);
		addHistoryLog("撤销");
	}

	function redo() {
		if (!canRedo()) return;
		historyIndex++;
		const state = historyStack[historyIndex].json;
		fabricCanvas.loadFromJSON(
			state,
			fabricCanvas.renderAll.bind(fabricCanvas),
			function () {
				renderHistoryPanel();
				triggerUpload("redo");
			}
		);
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

	// ========= 颜色 / 橡皮（妥协方案：背景色覆盖）管理 ==========
	// setBrushColor：设置画笔颜色，并确保退出橡皮模式
	function setBrushColor(color) {
		currentColor = color;
		// 选择颜色时自动退出橡皮（常见交互）
		isEraserMode = false;
		if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
			fabricCanvas.freeDrawingBrush.color = color;
			try {
				fabricCanvas.freeDrawingBrush.globalCompositeOperation =
					"source-over";
			} catch (e) {
				/* ignore */
			}
		}
		updateColorSwatchUI(color);
	}

	// 把画笔颜色设置为画布背景色（实现“覆盖式橡皮”）
	function setEraserMode() {
		isEraserMode = true;
		if (!fabricCanvas || !fabricCanvas.freeDrawingBrush) {
			updateEraserUI(true);
			return;
		}

		// 读取画布背景色，若无则使用白色
		const bg = fabricCanvas.backgroundColor
			? fabricCanvas.backgroundColor
			: "#ffffff";
		try {
			// 保存当前 brush 宽度/颜色（以便 restore 时恢复）
			// 注意：我们通过外部变量 currentColor 保存用户颜色；brush.width 不需要额外记录
			fabricCanvas.freeDrawingBrush.color = bg;
			fabricCanvas.freeDrawingBrush.globalCompositeOperation =
				"source-over";
		} catch (e) {
			console.warn(
				"[橡皮] 无法设置 brush 属性，继续尝试以背景色覆盖",
				e
			);
			try {
				fabricCanvas.freeDrawingBrush.color = bg;
			} catch (ee) {
				/* ignore */
			}
		}
		updateEraserUI(true);
	}

	// 恢复画笔模式（将颜色恢复为用户选择的颜色）
	function restoreBrushMode() {
		isEraserMode = false;
		if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
			try {
				fabricCanvas.freeDrawingBrush.globalCompositeOperation =
					"source-over";
			} catch (e) {
				/* ignore */
			}
			fabricCanvas.freeDrawingBrush.color = currentColor;
		}
		updateEraserUI(false);
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

		// 如果当前是橡皮模式，选择颜色意味着恢复画笔
		if (isEraserMode) restoreBrushMode();
	}

	function updateEraserUI(active) {
		const eraserBtn = document.getElementById("eraser-btn");
		if (!eraserBtn) return;
		if (active) eraserBtn.classList.add("active");
		else eraserBtn.classList.remove("active");
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
			// opt.path 为被创建的 path。我们使用统一逻辑：
			// - 如果是橡皮模式（覆盖式）: 该 path 已被绘制为背景色并已添加到对象栈 -> 我们保持它为普通对象，
			//   这样撤销时 fabric.loadFromJSON 能够恢复被覆盖前的状态（注意：因为覆盖只是用普通路径覆盖像素，撤销就是 loadFromJSON 恢复覆盖之前的像素）
			// - 如果不是橡皮: 正常路径入栈
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
		const downloadBtn = document.getElementById("download-btn");

		if (undoBtn) undoBtn.addEventListener("click", () => undo());
		if (redoBtn) redoBtn.addEventListener("click", () => redo());

		if (resetBtn) {
			resetBtn.addEventListener("click", function () {
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

		// 笔刷大小同步
		const sizeRange = document.getElementById("brush-size");
		if (sizeRange) {
			sizeRange.addEventListener("input", function (e) {
				const size = parseInt(e.target.value, 10);
				if (fabricCanvas && fabricCanvas.freeDrawingBrush)
					fabricCanvas.freeDrawingBrush.width = size;
			});
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
