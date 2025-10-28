/* canvas.app.js
   说明：
   - 创建全局命名空间 CanvasApp (或 App)
   - 挂载所有模块共享的状态变量
   - 定义全局启动函数 window.canvasModuleInit
   - [!] 此文件必须在所有其他 canvas.*.js 模块之前加载
*/

// 创建全局命名空间
window.CanvasApp = {
	// ========= 共享状态变量 =========
	socket: null,
	heartbeatTimer: null,
	reconnectTimer: null,

	fabricCanvas: null,

	// history 管理
	historyStack: [],
	historyIndex: -1,

	// 工具状态
	currentColor: "#000000",
	isEraserMode: false,
	isFillMode: false,

	// 上传防抖
	uploadDebounceTimer: null,

	// ========= 模块占位符 (由其他文件填充) =========
	config: {},
	utils: {},
	// websocket 模块...
	// history 模块...
	// fabric 模块...
	// ui 模块...
	// upload 模块...
};

// ========= 主初始化函数（暴露到 window） ==========
(function (App) {
	"use strict";

	// window.canvasModuleInit 由 canvas.html 调用
	window.canvasModuleInit = function () {
		// 按顺序初始化核心模块
		App.initFabricCanvas();
		App.initColorPickerAndTools();

		App.connectWebSocket();

		console.log("[系统] 画布模块初始化完成");
	};
})(window.CanvasApp);
