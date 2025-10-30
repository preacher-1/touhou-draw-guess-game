/* canvas.ui.js
   说明：
   - 封装所有 DOM 事件监听（工具栏、按钮、滑块等）
   - 包含工具栏 UI 更新的辅助函数
   - 依赖: App (几乎所有模块)
*/
(function (App) {
	"use strict";

	// ========= UI 辅助函数 ==========

	// UI：颜色 swatch 的 active 同步
	App.updateColorSwatchUI = function (color) {
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
		if (App.isEraserMode) App.restoreBrushMode();
		if (App.isFillMode) App.restoreBrushModeFromFill();
	};

	App.updateEraserUI = function (active) {
		const eraserBtn = document.getElementById("eraser-btn");
		if (!eraserBtn) return;
		if (active) eraserBtn.classList.add("active");
		else eraserBtn.classList.remove("active");
	};

	// 此函数用于处理光标和对象选择性
	App.updateFillUI = function (active) {
		const fillBtn = document.getElementById("fill-btn");
		if (!fillBtn) return;

		if (active) {
			fillBtn.classList.add("active");
			if (App.fabricCanvas) {
				// 禁用对象选择，防止光标变为“移动”
				App.fabricCanvas.selection = false;
				App.fabricCanvas.defaultCursor = "crosshair";
				// 强制悬停光标也为 'crosshair'
				App.fabricCanvas.hoverCursor = "crosshair";
				// 遍历所有对象，使其不可选中
				App.fabricCanvas.forEachObject((o) =>
					o.set("selectable", false)
				);
				App.fabricCanvas.renderAll();
			}
		} else {
			fillBtn.classList.remove("active");
			if (App.fabricCanvas) {
				// 恢复对象选择
				App.fabricCanvas.selection = true;
				App.fabricCanvas.defaultCursor = "default";
				// 恢复悬停光标
				App.fabricCanvas.hoverCursor = "move";
				// 恢复对象的可选性
				App.fabricCanvas.forEachObject((o) =>
					o.set("selectable", true)
				);
				App.fabricCanvas.renderAll();
			}
		}
		// 注意：fabricCanvas.isDrawingMode 由 setFillMode 和 restoreBrushModeFromFill 控制
	};

	// ========= 初始化 Fabric.js ==========
	App.initColorPickerAndTools = function () {
		const swatches = document.querySelectorAll(".color-swatch");
		const colorInput = document.getElementById("brush-color");

		swatches.forEach((swatch) => {
			swatch.addEventListener("click", () => {
				const color = swatch.dataset.color;
				App.setBrushColor(color);
				App.addHistoryLog(`选择颜色 ${color}`);
			});
		});

		if (colorInput) {
			colorInput.addEventListener("input", function () {
				const color = colorInput.value;
				App.setBrushColor(color);
				App.addHistoryLog(`自选颜色 ${color}`);
			});
		}

		// 工具按钮：撤销 / 重做 / 重置 / 橡皮 / 保存
		const undoBtn = document.getElementById("undo-btn");
		const redoBtn = document.getElementById("redo-btn");
		const resetBtn = document.getElementById("reset-btn");
		const eraserBtn = document.getElementById("eraser-btn");
		const fillBtn = document.getElementById("fill-btn");
		const downloadBtn = document.getElementById("download-btn");

		if (undoBtn) undoBtn.addEventListener("click", () => App.undo());
		if (redoBtn) redoBtn.addEventListener("click", () => App.redo());

		if (resetBtn) {
			resetBtn.addEventListener("click", function () {
				// === 1. 重置画布 ===
				App.fabricCanvas.clear();
				App.fabricCanvas.backgroundColor = "#ffffff";
				const json = App.fabricCanvas.toJSON();
				App.historyStack = [
					{ json: json, label: "初始画布", time: new Date() },
				];
				App.historyIndex = 0;
				App.renderHistoryPanel();
				App.triggerUpload("reset");
				App.addHistoryLog("重置画布");

				// === 2. 重置工具 ===

				// 2a. 定义默认值
				const defaultColor = "#000000";
				const defaultSize = 6;

				// 2b. 重置颜色 (这将自动退出橡皮/油漆桶模式)
				App.setBrushColor(defaultColor);

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
					if (App.fabricCanvas && App.fabricCanvas.freeDrawingBrush) {
						App.fabricCanvas.freeDrawingBrush.width = defaultSize;
					}
				} catch (e) {
					console.error("[重置] 无法重置笔刷大小", e);
				}
			});
		}

		if (eraserBtn) {
			eraserBtn.addEventListener("click", function () {
				if (!App.isEraserMode) {
					App.setEraserMode();
					App.addHistoryLog("切换到橡皮擦（背景色覆盖）");
				} else {
					App.restoreBrushMode();
					App.addHistoryLog("恢复画笔");
				}
			});
		}

		if (fillBtn) {
			fillBtn.addEventListener("click", function () {
				if (!App.isFillMode) {
					App.setFillMode();
				} else {
					App.restoreBrushModeFromFill();
				}
			});
		}

		if (downloadBtn) {
			downloadBtn.addEventListener("click", function () {
				const dataURL = App.fabricCanvas.toDataURL({ format: "png" });
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
				App.addHistoryLog("保存画布");
			});
		}

		// 笔刷大小同步与预览
		const sizeRange = document.getElementById("brush-size");
		const previewDot = document.getElementById("brush-preview-dot");
		if (sizeRange && previewDot) {
			const updateBrushSize = (size) => {
				if (App.fabricCanvas && App.fabricCanvas.freeDrawingBrush) {
					App.fabricCanvas.freeDrawingBrush.width = size;
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

		// /**
		//  * 启用或禁用整个工具栏
		//  * @param {boolean} enabled
		//  */
		// App.setToolbarEnabled = function (enabled) {
		// 	const toolbar = document.querySelector(".toolbar");
		// 	if (!toolbar) return;

		// 	if (enabled) {
		// 		toolbar.classList.remove("toolbar-disabled");
		// 	} else {
		// 		toolbar.classList.add("toolbar-disabled");
		// 	}
		// };

		// /**
		//  * (由 websocket.js 调用) 更新计时器 UI
		//  * @param {object} msg - { type: "timer", value: number, by: string }
		//  */
		// App.updateTimerUI = function (msg) {
		// 	const timerDisplay = document.getElementById("timer-display");
		// 	if (!timerDisplay) return;

		// 	const value = msg.value ?? "?";

		// 	if (msg.by === "reset") {
		// 		timerDisplay.textContent = `计时器已重置 (${value}s)`;
		// 		timerDisplay.classList.remove("low-time");
		// 	} else if (msg.by === "countdown") {
		// 		const minutes = String(Math.floor(value / 60)).padStart(2, "0");
		// 		const seconds = String(value % 60).padStart(2, "0");
		// 		timerDisplay.textContent = `倒计时: ${minutes}:${seconds}`;

		// 		if (value <= 30) {
		// 			timerDisplay.classList.add("low-time");
		// 		} else {
		// 			timerDisplay.classList.remove("low-time");
		// 		}
		// 	}
		// };

		// /**
		//  * (由 websocket.js 调用) 更新游戏状态 UI
		//  * @param {object} state - 游戏状态 payload
		//  */
		// App.updateGameUI = function (state) {
		// 	const statusArea = document.getElementById("status-area");
		// 	const canvas = App.fabricCanvas;

		// 	// 1. 更新状态文本
		// 	if (statusArea) {
		// 		const phaseMap = {
		// 			IDLE: "空闲",
		// 			WAITING: "等待开始",
		// 			DRAWING: "绘画中",
		// 			REVEAL_WAITING: "等待揭晓",
		// 		};
		// 		const phaseText = phaseMap[state.phase] || state.phase;
		// 		if (state.round === 0) {
		// 			statusArea.textContent = `状态: 游戏未开始`;
		// 		} else {
		// 			statusArea.textContent = `状态: R${state.round} (T${state.try_num}) - ${phaseText}`;
		// 		}
		// 	}

		// 	// 2. 启用/禁用画布和工具栏
		// 	if (!canvas) {
		// 		console.warn("[UI] Fabric canvas 尚未初始化");
		// 		return;
		// 	}

		// 	if (state.phase === "DRAWING") {
		// 		canvas.interactive = true;
		// 		App.setToolbarEnabled(true);
		// 		console.log("[UI] 画布和工具栏已启用");
		// 	} else {
		// 		// 在 IDLE, WAITING, REVEAL_WAITING 等所有其他阶段禁用
		// 		canvas.interactive = false;
		// 		App.setToolbarEnabled(false);
		// 		console.log("[UI] 画布和工具栏已禁用");
		// 	}
		// };
	};

	/**
	 * 启用或禁用整个工具栏
	 * @param {boolean} enabled
	 */
	App.setToolbarEnabled = function (enabled) {
		const toolbar = document.querySelector(".toolbar");
		if (!toolbar) return;

		if (enabled) {
			toolbar.classList.remove("toolbar-disabled");
		} else {
			toolbar.classList.add("toolbar-disabled");
		}
	};

	/**
	 * (由 websocket.js 调用) 更新计时器 UI
	 * @param {object} msg - { type: "timer", value: number, by: string }
	 */
	App.updateTimerUI = function (msg) {
		const timerDisplay = document.getElementById("timer-display");
		if (!timerDisplay) return;

		const value = msg.value ?? "?";

		if (msg.by === "reset") {
			timerDisplay.textContent = `计时器已重置 (${value}s)`;
			timerDisplay.classList.remove("low-time");
		} else if (msg.by === "countdown") {
			const minutes = String(Math.floor(value / 60)).padStart(2, "0");
			const seconds = String(value % 60).padStart(2, "0");
			timerDisplay.textContent = `倒计时: ${minutes}:${seconds}`;

			if (value <= 30) {
				timerDisplay.classList.add("low-time");
			} else {
				timerDisplay.classList.remove("low-time");
			}
		}
	};

	/**
	 * (由 websocket.js 调用) 更新游戏状态 UI
	 * @param {object} state - 游戏状态 payload
	 */
	App.updateGameUI = function (state) {
		const infoRound = document.getElementById("game-info-round");
		const infoTarget = document.getElementById("game-info-target");
		const canvas = App.fabricCanvas;

		// 1. 更新状态文本
		if (infoRound && infoTarget) {
			const phaseMap = {
				IDLE: "空闲",
				WAITING: "等待开始",
				DRAWING: "绘画中",
				REVEAL_WAITING: "等待揭晓",
			};
			const phaseText = phaseMap[state.phase] || state.phase;

			if (state.round === 0) {
				infoRound.textContent = `状态: 游戏未开始`;
				infoTarget.textContent = `目标: ---`;
			} else {
				// 格式化文本
				infoRound.textContent = `第${state.round}轮 (第${state.try_num}次尝试) - ${phaseText}`;
				infoTarget.textContent = `目标: ${state.target_name || "???"}`;
			}
		}

		// 2. 启用/禁用画布和工具栏
		if (!canvas) {
			console.warn("[UI] Fabric canvas 尚未初始化");
			return;
		}

		// (--- 这是关键修复 ---)
		if (state.phase === "DRAWING") {
			canvas.interactive = true; // 允许对象交互
			canvas.isDrawingMode = true; // 允许自由绘制

			// 确保对象可交互
			canvas.forEachObject(function (o) {
				o.selectable = true;
				o.evented = true;
			});
			App.setToolbarEnabled(true);
			console.log("[UI] 画布和工具栏已启用");
		} else {
			// 在 IDLE, WAITING, REVEAL_WAITING 等所有其他阶段禁用
			canvas.interactive = false; // 禁用对象交互
			canvas.isDrawingMode = false; // 禁用自由绘制

			canvas.discardActiveObject(); // 取消当前可能选中的对象
			canvas.forEachObject(function (o) {
				o.selectable = false; // 禁止选中
				o.evented = false; // 禁止触发事件 (更彻底)
			});
			App.setToolbarEnabled(false);
			console.log("[UI] 画布和工具栏已禁用");

			canvas.defaultCursor = "default";
			canvas.hoverCursor = "default";
			canvas.renderAll(); // 重新渲染以应用更改并更新光标
		}
	};
})(window.CanvasApp);
