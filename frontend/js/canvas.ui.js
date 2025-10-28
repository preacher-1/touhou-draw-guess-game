/* canvas.ui.js
   说明：
   - 封装所有 DOM 事件监听（工具栏、按钮、滑块等）
   - 包含工具栏 UI 更新的辅助函数
   - 依赖: App (几乎所有模块)
*/
(function (App) {
	"use strict";

	// ========= UI 辅助函数 ==========

	App.getRoundInputValue = function () {
		const el = document.getElementById("round-input");
		if (!el) return 1;
		const v = parseInt(el.value, 10);
		return isNaN(v) ? 1 : v;
	};

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
	};
})(window.CanvasApp);
