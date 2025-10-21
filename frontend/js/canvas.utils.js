/* canvas.utils.js
   说明：
   - 存放通用的、无状态的工具函数
   - 附加到 CanvasApp.utils 对象 (或 App)
*/
(function (App) {
	"use strict";

	// ========== 通用工具函数 ==========

	/**
	 * @description 防抖函数
	 */
	App.debounce = function (fn, ms) {
		let t = null;
		return function (...args) {
			if (t) clearTimeout(t);
			t = setTimeout(() => fn.apply(this, args), ms);
		};
	};

	/**
	 * @description 调整 DataURL 图像大小
	 */
	App.dataURLResize = function (dataURL, maxSide, callback) {
		const img = new Image();
		img.onload = function () {
			const ratio = Math.min(
				maxSide / img.width,
				maxSide / img.height,
				1
			);
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(img.width * ratio);
			canvas.height = Math.round(img.height * ratio);
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			callback(canvas.toDataURL("image/png"));
		};
		img.src = dataURL;
	};
})(window.CanvasApp);
