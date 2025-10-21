/* canvas.fabric.js
   说明：
   - 封装所有 Fabric.js 的初始化和核心交互逻辑
   - 包含油漆桶、橡皮擦、画笔模式的实现
   - [!] 此文件应在依赖的模块 (ui, history, upload) 之后加载
*/
(function (App) {
	"use strict";

	// ========= 内部辅助函数（油漆桶） ==========
	// 这些函数是本模块私有的，不会附加到 App 对象

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

	// ========= 颜色 / 橡皮 / 油漆桶 管理 ==========
	// setBrushColor：设置画笔颜色，并确保退出橡皮/油漆桶模式
	App.setBrushColor = function (color) {
		App.currentColor = color;
		// 选择颜色时自动退出特殊模式（常见交互）
		App.isEraserMode = false;
		App.isFillMode = false;
		if (App.fabricCanvas && App.fabricCanvas.freeDrawingBrush) {
			App.fabricCanvas.isDrawingMode = true; // 确保恢复绘画模式
			App.fabricCanvas.freeDrawingBrush.color = color;
			try {
				App.fabricCanvas.freeDrawingBrush.globalCompositeOperation =
					"source-over";
			} catch (e) {
				/* ignore */
			}
		}
		App.updateColorSwatchUI(color);
		App.updateEraserUI(false);
		App.updateFillUI(false);
	};

	// 把画笔颜色设置为画布背景色（实现“覆盖式橡皮”）
	App.setEraserMode = function () {
		App.isEraserMode = true;
		App.isFillMode = false; // 退出油漆桶
		if (!App.fabricCanvas || !App.fabricCanvas.freeDrawingBrush) {
			App.updateEraserUI(true);
			return;
		}

		App.fabricCanvas.isDrawingMode = true; // 确保是绘画模式

		const bg = "#ffffff";
		try {
			App.fabricCanvas.freeDrawingBrush.color = bg;
			App.fabricCanvas.freeDrawingBrush.globalCompositeOperation =
				"source-over";
		} catch (e) {
			console.warn("[橡皮] 无法设置 brush 属性，继续尝试以背景色覆盖", e);
			try {
				App.fabricCanvas.freeDrawingBrush.color = bg;
			} catch (ee) {
				/* ignore */
			}
		}
		App.updateEraserUI(true);
		App.updateFillUI(false); // 进入橡皮模式时退出油漆桶模式
	};

	// 恢复画笔模式（将颜色恢复为用户选择的颜色）
	App.restoreBrushMode = function () {
		App.isEraserMode = false;
		App.isFillMode = false;
		if (App.fabricCanvas && App.fabricCanvas.freeDrawingBrush) {
			App.fabricCanvas.isDrawingMode = true; // 确保是绘画模式
			try {
				App.fabricCanvas.freeDrawingBrush.globalCompositeOperation =
					"source-over";
			} catch (e) {
				/* ignore */
			}
			App.fabricCanvas.freeDrawingBrush.color = App.currentColor;
		}
		App.updateEraserUI(false);
		App.updateFillUI(false);
	};

	// 进入油漆桶模式
	App.setFillMode = function () {
		App.isFillMode = true;
		App.isEraserMode = false; // 退出橡皮模式
		if (App.fabricCanvas) {
			App.fabricCanvas.isDrawingMode = false; // 退出自由绘画 (关键)
		}
		App.updateFillUI(true);
		App.updateEraserUI(false);
		App.addHistoryLog("切换到油漆桶模式");
	};

	// 恢复画笔模式（从油漆桶模式）
	App.restoreBrushModeFromFill = function () {
		App.isFillMode = false;
		if (App.fabricCanvas) {
			App.fabricCanvas.isDrawingMode = true; // 恢复自由绘画
		}
		App.updateFillUI(false);
		App.addHistoryLog("恢复画笔（从油漆桶）");
	};

	// ========= 初始化 Fabric.js ==========
	App.initFabricCanvas = function () {
		App.fabricCanvas = new fabric.Canvas("main-canvas", {
			isDrawingMode: true,
			backgroundColor: "#ffffff",
			width: window.innerWidth - 300,
			height: window.innerHeight - 60,
			preserveObjectStacking: true,
		});

		// 使用 PencilBrush（常见且稳定）
		App.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(
			App.fabricCanvas
		);
		App.fabricCanvas.freeDrawingBrush.width = 6;
		App.fabricCanvas.freeDrawingBrush.color = App.currentColor;
		App.fabricCanvas.freeDrawingBrush.globalCompositeOperation =
			"source-over";

		// 绘制完成时（path:created）-- 非橡皮与橡皮都做历史入栈
		App.fabricCanvas.on("path:created", function (opt) {
			try {
				if (App.isEraserMode) {
					App.pushStateToHistory("橡皮擦");
					App.renderHistoryPanel();
					App.triggerUpload("erase");
				} else {
					App.pushStateToHistory("绘制路径");
					App.renderHistoryPanel();
					App.triggerUpload("draw");
				}
			} catch (e) {
				console.error("[path:created] 历史入栈失败", e);
			}
		});

		// 油漆桶点击事件
		App.fabricCanvas.on("mouse:down", function (options) {
			if (!App.isFillMode) return;

			// 阻止 fabric 默认的选择/拖拽行为
			if (options.target) {
				options.e.preventDefault();
			}

			console.log("[油漆桶] 检测到点击事件（栅格化方案）");
			const pointer = App.fabricCanvas.getPointer(options.e);
			const x = Math.round(pointer.x);
			const y = Math.round(pointer.y);

			// (步骤 1: 强制渲染最新状态)
			try {
				App.fabricCanvas.renderAll();
			} catch (e) {
				console.error("[油漆桶] 步骤 1: renderAll 失败", e);
				return;
			}

			// (步骤 2: "栅格化" - 获取包含所有对象和背景的 DataURL)
			const currentDataURL = App.fabricCanvas.toDataURL({
				format: "png",
			});

			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = App.fabricCanvas.width;
			tempCanvas.height = App.fabricCanvas.height;
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
				const colorToFill = fabric.Color.fromHex(
					App.currentColor
				).getSource(); // [R, G, B, A]
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
					App.fabricCanvas.setBackgroundImage(
						filledImg,
						function () {
							// 7a. 清空所有旧的矢量对象（只清除对象，保留背景图）
							// 遍历并移除所有 Fabric 对象
							const allObjects = App.fabricCanvas.getObjects();
							allObjects.forEach((obj) => {
								App.fabricCanvas.remove(obj);
							});

							App.fabricCanvas.backgroundColor = "transparent"; // 背景已是图片

							// 7b. (记录历史)
							App.pushStateToHistory("油漆桶填充");
							App.triggerUpload("fill");
							console.log(
								"[油漆桶] 步骤 7: 操作完成并已记录历史。"
							);

							// 7c. 渲染最终状态
							App.fabricCanvas.renderAll();
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
		App.fabricCanvas.on("object:modified", function () {
			App.pushStateToHistory("修改对象");
			App.renderHistoryPanel();
			App.triggerUpload("modify");
		});

		// 把初始空白状态入栈（保证第一次撤销可以回到空白）
		(function pushInitial() {
			try {
				const json = App.fabricCanvas.toJSON();
				App.historyStack = [
					{ json: json, label: "初始画布", time: new Date() },
				];
				App.historyIndex = 0;
				App.renderHistoryPanel();
			} catch (e) {
				console.error("[历史] 初始状态入栈失败", e);
			}
		})();

		// 窗口尺寸变化时调整 canvas 大小
		window.addEventListener("resize", function () {
			App.fabricCanvas.setDimensions({
				width: window.innerWidth - 300,
				height: window.innerHeight - 60,
			});
		});
	};
})(window.CanvasApp);
