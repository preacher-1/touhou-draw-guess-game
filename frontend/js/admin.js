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

	// 按钮状态设置辅助函数，注意变量值为disabled
	function setAllButtons(disabled) {
		resetBtn.disabled = disabled;
		startBtn.disabled = disabled;
		nextRoundBtn.disabled = disabled;
		revealBtn.disabled = disabled;
		nextTryBtn.disabled = disabled;
	}
	setAllButtons(true); // 默认禁用，等待 WS 同步

	// --- 2. WebSocket 核心 ---
	let ws = null;

	function connect() {
		// (使用与 canvas.config.js 相同的逻辑)
		const wsURL =
			(window.location.protocol === "https:" ? "wss://" : "ws://") +
			window.location.host +
			"/ws/listener"; //

		ws = new WebSocket(wsURL);

		ws.onopen = () => {
			console.log("✅ [AdminWS] WebSocket 已连接");
			wsStatus.textContent = "🟢 已连接";
			wsStatus.style.color = "green";
			// 你可以发送一个 'hello' 消息
			sendMessage({ type: "hello", client: "admin" });
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
			setTimeout(connect, 3000 + Math.random() * 2000);
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
			case "timer":
				updateTimer(data);
				break;
			case "game_state_update":
				updateGameState(data.payload);
				break;
			case "top5":
			case "image":
				// Admin 页面暂时不需要这些
				break;
			default:
				console.log("⚙️ [AdminWS] 其它类型消息:", data);
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
		// WAITING 状态：允许开始、重置、下一轮
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
		}
		// REVEAL_WAITING 状态：允许揭晓、下一轮、第 2 次尝试
		else if (state.phase === "REVEAL_WAITING") {
			setAllButtons(true);
			nextRoundBtn.disabled = false;
			revealBtn.disabled = false;

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
	connect();
})();
