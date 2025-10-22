/* canvas.upload.js
   说明：
   - 封装画布上传（推送）的防抖和实现逻辑
   - 依赖: App.config, App.utils, App.sendMessage, App.getRoundInputValue
*/
(function (App) {
	"use strict";

	// ========= 上传节流 ==========
	App.triggerUpload = function (last_action = "auto") {
		if (App.uploadDebounceTimer) clearTimeout(App.uploadDebounceTimer);
		App.uploadDebounceTimer = setTimeout(() => {
			App.uploadCanvas(last_action);
		}, App.config.UPLOAD_DEBOUNCE_MS);
	};

	App.uploadCanvas = function (last_action = "auto") {
		if (!App.fabricCanvas) return;
		const dataURL = App.fabricCanvas.toDataURL({
			format: "jpeg",
			quality: 1,
		});
		App.sendMessage({
			type: "canvas_update",
			// round: App.getRoundInputValue(),
			data_url: dataURL,
			last_action: last_action,
			timestamp: Date.now(),
		});
		console.log("canvas upload");
		// App.utils.dataURLResize(
		// 	dataURL,
		// 	App.config.MAX_SIDE,
		// 	(smallDataURL) => {
		// 		App.sendMessage({
		// 			type: "canvas_update",
		// 			// round: App.getRoundInputValue(),
		// 			data_url: smallDataURL,
		// 			last_action: last_action,
		// 			timestamp: Date.now(),
		// 		});
		// 	}
		// );
	};
})(window.CanvasApp);
