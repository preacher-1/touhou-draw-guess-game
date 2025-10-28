/* canvas.config.js
   说明：
   - 将所有硬编码的配置常量分离到此文件
   - 附加到 CanvasApp.config 对象
*/
(function (App) {
	"use strict";

	App.config = {
		// WebSocket 地址构造策略
		WS_URL:
			(window.location.protocol === "https:" ? "wss://" : "ws://") +
			window.location.host +
			"/ws/listener",
		HEARTBEAT_INTERVAL: 30000,

		// 上传配置
		UPLOAD_DEBOUNCE_MS: 400,
		MAX_SIDE: 512,

		// 历史配置
		HISTORY_LIMIT: 100,
	};
})(window.CanvasApp);
