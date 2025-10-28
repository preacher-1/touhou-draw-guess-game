// frontend/js/admin.js

(function () {
	"use strict";

	// --- 1. DOM 元素 ---
	const wsStatus = document.getElementById("ws-status");
	const timerDisplay = document.getElementById("timer-display");
	const gameStatus = document.getElementById("game-status");
	const resetBtn = document.getElementById("reset-timer-btn");
	const startBtn = document.getElementById("start-timer-btn");

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
				// (R4) 我们将在未来实现
				// gameStatus.textContent = `${data.phase}`;
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

	// --- 启动连接 ---
	connect();
})();
