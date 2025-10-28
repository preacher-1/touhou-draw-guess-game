/* canvas.websocket.js
   说明：
   - 封装所有 WebSocket 通信逻辑
   - 依赖: App.config
*/
(function (App) {
	"use strict";

	// ========= WebSocket（保留原逻辑） =========
	App.connectWebSocket = function () {
		App.socket = new WebSocket(App.config.WS_URL);

		App.socket.addEventListener("open", () => {
			console.log("[WS] connected");
			App.sendMessage({
				type: "hello",
				client: "canvas",
				timestamp: Date.now(),
			});
			App.startHeartbeat();
			if (App.reconnectTimer) {
				clearTimeout(App.reconnectTimer);
				App.reconnectTimer = null;
			}
		});

		App.socket.addEventListener("message", (ev) => {
			let msg = null;
			try {
				msg = JSON.parse(ev.data);
			} catch (e) {
				console.warn("[WS] invalid json", ev.data);
				return;
			}
			App.handleServerMessage(msg);
		});

		App.socket.addEventListener("close", (ev) => {
			console.warn("[WS] closed", ev);
			App.stopHeartbeat();
			App.scheduleReconnect();
		});

		App.socket.addEventListener("error", (ev) => {
			console.error("[WS] error", ev);
			App.socket.close();
		});
	};

	App.scheduleReconnect = function () {
		if (App.reconnectTimer) return;
		App.reconnectTimer = setTimeout(() => {
			console.log("[WS] attempting reconnect...");
			App.connectWebSocket();
		}, 2000 + Math.random() * 3000);
	};

	App.startHeartbeat = function () {
		if (App.heartbeatTimer) clearInterval(App.heartbeatTimer);
		App.heartbeatTimer = setInterval(() => {
			if (App.socket && App.socket.readyState === WebSocket.OPEN)
				App.sendMessage({ type: "ping", timestamp: Date.now() });
		}, App.config.HEARTBEAT_INTERVAL);
	};

	App.stopHeartbeat = function () {
		if (App.heartbeatTimer) {
			clearInterval(App.heartbeatTimer);
			App.heartbeatTimer = null;
		}
	};

	App.sendMessage = function (obj) {
		if (!App.socket || App.socket.readyState !== WebSocket.OPEN) return;
		App.socket.send(JSON.stringify(obj));
	};

	App.handleServerMessage = function (msg) {
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
	};
})(window.CanvasApp);
