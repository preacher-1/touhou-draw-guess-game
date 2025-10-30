// frontend/js/admin.js

(function () {
	"use strict";

	// --- 1. DOM 元素 ---
	const wsStatus = document.getElementById("ws-status");
	const timerDisplay = document.getElementById("timer-display");
	const gameStatus = document.getElementById("game-status");
	const resetBtn = document.getElementById("reset-timer-btn"); // 重置计时
	const startBtn = document.getElementById("start-timer-btn"); // 开始计时

	const nextRoundBtn = document.getElementById("next-round-btn"); // 下一轮
	const nextTryBtn = document.getElementById("next-try-btn"); // 第二次尝试
	const revealBtn = document.getElementById("reveal-results-btn"); // 显示结果
	const top5List = document.getElementById("top5-list"); // Top 5 列表
	const manualSaveBtn = document.getElementById("manual-save-btn"); // 手动保存

	// 按钮状态设置辅助函数，注意变量值为disabled
	function setAllButtons(disabled) {
		resetBtn.disabled = disabled;
		startBtn.disabled = disabled;
		nextRoundBtn.disabled = disabled;
		revealBtn.disabled = disabled;
		nextTryBtn.disabled = disabled;
		manualSaveBtn.disabled = disabled;
	}
	setAllButtons(true); // 默认禁用，等待 WS 同步

	// --- 2. WebSocket 核心 ---
	let ws = null;

	function connect(password) {
		// (使用与 canvas.config.js 相同的逻辑)
		const wsURL =
			(window.location.protocol === "https:" ? "wss://" : "ws://") +
			window.location.host +
			"/ws/listener"; //

		ws = new WebSocket(wsURL);

		ws.onopen = () => {
			console.log("⚠️ [AdminWS] WebSocket 未验证");
			wsStatus.textContent = "🟠 未验证";
			wsStatus.style.color = "orange";
			// 发送验证请求
			// sendMessage({ type: "hello", client: "admin" });
			sendMessage({ type: "auth", password: password });
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				handleMessage(data);
			} catch (err) {
				console.error("❌ [AdminWS] JSON 解析错误:", err, event.data);
			}
		};

		ws.onclose = () => {
			console.warn("🔌 [AdminWS] WebSocket 已断开");
			wsStatus.textContent = "🔴 已断开";
			wsStatus.style.color = "red";
			ws = null;
			// 自动重连
			setTimeout(() => connect(password), 3000 + Math.random() * 2000);
		};

		ws.onerror = (err) => {
			console.error("❌ [AdminWS] WebSocket 错误:", err);
			ws.close();
		};
	}

	function sendMessage(obj) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(obj));
		} else {
			console.warn("[AdminWS] 发送失败，WS 未连接。");
		}
	}

	// --- 3. 消息处理器 ---
	function handleMessage(data) {
		console.log("📩 [AdminWS] 收到消息:", data);
		switch (data.type) {
			case "auth_result":
				processAuthResult(data.success);
			case "timer":
				updateTimer(data);
				break;
			case "game_state_update":
				updateGameState(data.payload);
				break;
			case "top5":
				updateTop5List(data.results);
				break;
			case "image":
				// Admin 页面暂时不需要这些
				break;
			default:
				console.log("⚙️ [AdminWS] 其它类型消息:", data);
		}
	}

	function processAuthResult(success) {
		if (success) {
			console.log("✅ [AdminWS] WebSocket 已验证");
			wsStatus.textContent = "🟢 已验证";
			wsStatus.style.color = "green";
		} else {
			// 如果“未验证”元素还没有及时更新，会被 alert 阻塞渲染
			// 使用 setTimeout 而不是直接执行，保证界面元素被更新
			// 只是一个效果上的小细节，不影响实际功能
			setTimeout(() => {
				alert("❌ 管理员认证失败，密码错误！");
				// 跳转回主界面
				window.location.href = "/";
			}, 100);
		}
	}

	// --- 4. 更新函数 ---
	function updateTimer(timerData) {
		// (此逻辑复用自 show.js)
		const value = timerData.value ?? "?";

		if (timerData.by === "reset") {
			timerDisplay.textContent = `${value}s (已重置)`;
			timerDisplay.style.color = "#0066cc";
		} else if (timerData.by === "countdown") {
			const minutes = String(Math.floor(value / 60)).padStart(2, "0");
			const seconds = String(value % 60).padStart(2, "0");
			timerDisplay.textContent = `${minutes}:${seconds}`;

			if (value <= 30) {
				timerDisplay.style.color = "red";
			} else {
				timerDisplay.style.color = "black";
			}
		} else {
			timerDisplay.textContent = `${value}s`;
		}
	}

	function updateGameState(state) {
		console.log("🔄 [AdminWS] 状态更新:", state);
		const phaseMap = {
			IDLE: "空闲",
			WAITING: "等待开始",
			DRAWING: "绘画中",
			REVEAL_WAITING: "等待揭晓",
		};

		if (state.round === 0) {
			gameStatus.textContent = "游戏未开始";
			nextRoundBtn.textContent = "开始第一轮";
		} else {
			gameStatus.textContent = `第 ${state.round} 轮 (第 ${
				state.try_num
			} 次尝试) - ${phaseMap[state.phase] || state.phase}`;
			nextRoundBtn.textContent = "开始下一轮";
		}

		// 根据状态启用/禁用按钮
		// IDLE 状态：只允许“下一轮”
		if (state.phase === "IDLE") {
			setAllButtons(true);
			nextRoundBtn.disabled = false;
		}
		// WAITING 状态：允许开始、重置、下一轮、手动保存
		else if (state.phase === "WAITING") {
			setAllButtons(false);
			revealBtn.disabled = true; // WAITING 时不能揭晓
			nextTryBtn.disabled = true; // WAITING 时不能点“第 2 次尝试”
			// nextTryBtn.style.display = "none";
		}
		// DRAWING 状态：只允许“重置”(用于中止)
		else if (state.phase === "DRAWING") {
			setAllButtons(true);
			resetBtn.disabled = false;
			manualSaveBtn.disabled = false; // 新增：可以手动保存
		}
		// REVEAL_WAITING 状态：允许揭晓、下一轮、第 2 次尝试、手动保存
		else if (state.phase === "REVEAL_WAITING") {
			setAllButtons(true);
			nextRoundBtn.disabled = false;
			revealBtn.disabled = false;
			manualSaveBtn.disabled = false;

			// “第 2 次尝试”要特判
			if (state.try_num === 1) {
				nextTryBtn.disabled = false;
				// nextTryBtn.style.display = "inline-block";
			} else {
				nextTryBtn.disabled = true;
			}
		}

		// 下一轮按钮文本特判
		if (state.round === 0) {
			nextRoundBtn.textContent = "开始第一轮";
		} else {
			nextRoundBtn.textContent = "开始下一轮";
		}
	}

	// Top5 更新函数
	/**
	 * @param {Array<{label: string, score: number}>} results
	 */
	function updateTop5List(results) {
		if (!top5List || !Array.isArray(results)) return;

		// (我们只显示 label, 未来可以考虑在 admin.js 中也加载 nameDataCN)
		const listItems = top5List.getElementsByTagName("li");

		for (let i = 0; i < listItems.length; i++) {
			if (results[i]) {
				const item = results[i];
				const scorePercent = (item.score * 100)
					.toFixed(1)
					.padStart(4, " "); // 补齐空格
				listItems[i].textContent = `${scorePercent}% - ${item.label}`;
			} else {
				listItems[i].textContent = "(n/a)";
			}
		}
	}

	// --- 5. 事件监听 ---
	resetBtn.addEventListener("click", () => {
		console.log("➡️ [AdminWS] 发送: 重置计时器");
		// 这是我们商定的新协议
		sendMessage({
			type: "command",
			payload: {
				action: "RESET_TIMER",
			},
		});
	});

	startBtn.addEventListener("click", () => {
		console.log("➡️ [AdminWS] 发送: 开始计时");

		// (未来我们可以从一个 <input> 框获取 duration)
		// const duration = document.getElementById("timer-duration-input").value;

		sendMessage({
			type: "command",
			payload: {
				action: "START_TIMER",
				// duration: duration
				// (我们暂时使用后端 的默认值,
				//  所以 payload 暂时不需要 duration)
			},
		});
	});

	nextRoundBtn.addEventListener("click", () => {
		console.log("➡️ [AdminWS] 发送: 开始下一轮/尝试");
		sendMessage({
			type: "command",
			payload: {
				action: "START_NEXT_ROUND",
			},
		});
	});

	nextTryBtn.addEventListener("click", () => {
		console.log("➡️ [AdminWS] 发送: 开始第 2 次尝试");
		sendMessage({
			type: "command",
			payload: {
				action: "START_NEXT_TRY", // (新 action)
			},
		});
	});

	manualSaveBtn.addEventListener("click", () => {
		// [新增] 手动保存事件
		if (
			confirm(
				"确定要手动保存当前服务器上的画布吗？\n（这不会影响游戏流程）"
			)
		) {
			console.log("➡️ [AdminWS] 发送: 手动保存画布");
			sendMessage({
				type: "command",
				payload: {
					action: "SAVE_CANVAS_MANUAL",
				},
			});
			alert("保存请求已发送！");
		}
	});

	revealBtn.addEventListener("click", () => {
		console.log("➡️ [AdminWS] 发送: 揭晓结果");
		sendMessage({
			type: "command",
			payload: {
				action: "REVEAL_RESULTS",
			},
		});
	});

	// --- 启动连接 ---
	promptPassword("请输入管理员密码").then(connect);
})();
