/* canvas.history.js
   说明：
   - 封装 undo/redo 及历史记录面板的逻辑
   - 依赖: App.config, App.fabricCanvas, App.triggerUpload
*/
(function (App) {
	"use strict";

	// ========= 历史（history）管理 ==========
	App.pushStateToHistory = function (label = "操作") {
		try {
			if (App.historyIndex < App.historyStack.length - 1) {
				App.historyStack = App.historyStack.slice(
					0,
					App.historyIndex + 1
				);
			}
			const json = App.fabricCanvas.toJSON();
			App.historyStack.push({
				json: json,
				label: label,
				time: new Date(),
			});
			if (App.historyStack.length > App.config.HISTORY_LIMIT)
				App.historyStack.shift();
			else App.historyIndex++;
			if (App.historyIndex >= App.historyStack.length)
				App.historyIndex = App.historyStack.length - 1;
			App.renderHistoryPanel();
		} catch (e) {
			console.error("[历史] push 失败", e);
		}
	};

	App.canUndo = function () {
		return App.historyIndex > 0;
	};
	App.canRedo = function () {
		return App.historyIndex < App.historyStack.length - 1;
	};

	App.undo = function () {
		if (!App.canUndo()) return;
		App.historyIndex--;
		const state = App.historyStack[App.historyIndex].json;
		App.fabricCanvas.loadFromJSON(state, function () {
			App.fabricCanvas.renderAll(); // 1. 渲染画布
			App.renderHistoryPanel(); // 2. 刷新历史UI
			App.triggerUpload("undo"); // 3. 上传
		});
		App.addHistoryLog("撤销");
	};

	App.redo = function () {
		if (!App.canRedo()) return;
		App.historyIndex++;
		const state = App.historyStack[App.historyIndex].json;
		App.fabricCanvas.loadFromJSON(state, function () {
			App.fabricCanvas.renderAll(); // 1. 渲染画布
			App.renderHistoryPanel(); // 2. 刷新历史UI
			App.triggerUpload("redo"); // 3. 上传
		});
		App.addHistoryLog("重做");
	};

	// 可视化历史面板（方块化）
	App.renderHistoryPanel = function () {
		const container = document.getElementById("history-list");
		if (!container) return;
		container.innerHTML = "";
		for (let i = App.historyStack.length - 1; i >= 0; i--) {
			const entry = App.historyStack[i];
			const node = document.createElement("div");
			node.className = "history-item-box";
			node.setAttribute("data-index", i);
			node.title = `${entry.label} — ${entry.time.toLocaleTimeString()}`;

			const text = document.createElement("div");
			text.className = "history-item-text";
			text.textContent = entry.label;
			node.appendChild(text);

			if (i > App.historyIndex) node.classList.add("history-item-future");
			else if (i === App.historyIndex)
				node.classList.add("history-item-current");
			else node.classList.add("history-item-past");

			(function (idx) {
				node.addEventListener("click", function () {
					App.historyIndex = idx;
					const state = App.historyStack[App.historyIndex].json;
					App.fabricCanvas.loadFromJSON(
						state,
						App.fabricCanvas.renderAll.bind(App.fabricCanvas),
						function () {
							App.renderHistoryPanel();
							App.triggerUpload("jump_history");
							App.addHistoryLog(
								`跳转历史: ${
									App.historyStack[App.historyIndex].label
								}`
							);
						}
					);
				});
			})(i);

			container.appendChild(node);
		}
	};

	App.addHistoryLog = function (text) {
		const time = new Date().toLocaleTimeString();
		console.log(`[操作] ${time} - ${text}`);
	};
})(window.CanvasApp);
