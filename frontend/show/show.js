// ChatGPT写的
// 抓取数据环节
const ws = new WebSocket(`ws://${location.host}/ws/listener`); // 初始定义websocket链接？
const imageDisplay = document.getElementById("canvas"); // 获取展示画布的元素canvas
const timerDisplay = document.getElementById("timer"); // 获取定时器的元素timer
const roundTitle = document.getElementById("round-title"); // 获取轮次标题的元素round-title

let currentTimerValue = 90; // 定义一个全局变量来存储当前的定时器值

const nameDataCN = {
	//中文名数据库
	aki_minoriko: "秋穰子",
	aki_shizuha: "秋静叶",
	alice_margatroid: "爱丽丝·玛格特洛依德",
	asakura_rikako: "朝仓理香子",
	chen: "橙",
	chirizuka_ubame: "尘塚姥芽",
	cirno: "琪露诺",
	clownpiece: "克劳恩皮丝",
	daiyousei: "大妖精",
	doremy_sweet: "哆来咪·苏伊特",
	ebisu_eika: "戎璎花",
	elis: "依莉斯",
	elly: "艾丽",
	eternity_larva: "爱塔妮缇拉尔瓦",
	flandre_scarlet: "芙兰朵露·斯卡蕾特",
	fujiwara_no_mokou: "藤原妹红",
	futatsuiwa_mamizou: "二岩猯藏",
	gengetsu: "幻月",
	hakurei_reimu: "博丽灵梦",
	haniyasushin_keiki: "埴安神袿姬",
	hata_no_kokoro: "秦心",
	hecatia_lapislazuli: "赫卡提亚·拉碧斯拉祖利",
	hieda_no_akyuu: "稗田阿求",
	hijiri_byakuren: "圣白莲",
	himekaidou_hatate: "姬海棠果",
	himemushi_momoyo: "姬虫百百世",
	hinanawi_tenshi: "比那名居天子",
	hong_meiling: "红美铃",
	horikawa_raiko: "堀川雷鼓",
	hoshiguma_yuugi: "星熊勇仪",
	houjuu_chimi: "封兽魑魅",
	houjuu_nue: "封兽鵺",
	houraisan_kaguya: "蓬莱山辉夜",
	ibaraki_kasen: "茨木华扇",
	ibuki_suika: "伊吹萃香",
	iizunamaru_megumu: "饭纲丸龙",
	imaizumi_kagerou: "今泉影狼",
	inaba_tewi: "因幡天为",
	inubashiri_momiji: "犬走椛",
	iwanaga_ariya: "磐永阿梨夜",
	izayoi_sakuya: "十六夜咲夜",
	joutougu_mayumi: "杖刀偶磨弓",
	junko: "纯狐",
	kaenbyou_rin: "火焰猫燐",
	kagiyama_hina: "键山雏",
	kaku_seiga: "霍青娥",
	kamishirasawa_keine: "上白泽慧音",
	kana_anaberal: "卡娜·安娜贝拉尔",
	kasodani_kyouko: "幽谷响子",
	kawashiro_nitori: "河城荷取",
	kazami_yuuka: "风见幽香",
	kicchou_yachie: "吉吊八千慧",
	kijin_seija: "鬼人正邪",
	kirisame_marisa: "雾雨魔理沙",
	kishin_sagume: "稀神探女",
	kisume: "琪斯美",
	kitashirakawa_chiyuri: "北白河千百合",
	koakuma: "小恶魔",
	kochiya_sanae: "东风谷早苗",
	komakusa_sannyo: "驹草山如",
	komano_aunn: "高丽野阿吽",
	komeiji_koishi: "古明地恋",
	komeiji_satori: "古明地觉",
	konngara: "矜羯罗",
	konpaku_youmu: "魂魄妖梦",
	kotohime: "小兔姬",
	kudamaki_tsukasa: "菅牧典",
	kumoi_ichirin: "云居一轮",
	kurokoma_saki: "骊驹早鬼",
	kurumi: "胡桃",
	letty_whiterock: "蕾蒂·霍瓦特洛克",
	lily_white: "莉莉霍瓦特",
	luize: "露易兹",
	lunasa_prismriver: "露娜萨·普莉兹姆利巴",
	luna_child: "露娜切露德",
	lyrica_prismriver: "莉莉卡·普莉兹姆利巴",
	mai: "舞",
	maribel_hearn: "玛艾露贝莉·赫恩",
	matara_okina: "摩多罗隐岐奈",
	medicine_melancholy: "梅蒂欣·梅兰可莉",
	meira: "明罗",
	merlin_prismriver: "梅露兰·普莉兹姆利巴",
	michigami_nareko: "道神驯子",
	mima: "魅魔",
	miyako_yoshika: "宫古芳香",
	mononobe_no_futo: "物部布都",
	moriya_suwako: "洩矢诹访子",
	motoori_kosuzu: "本居小铃",
	mugetsu: "梦月",
	murasa_minamitsu: "村纱水蜜",
	nagae_iku: "永江衣玖",
	nazrin: "娜兹玲",
	nishida_satono: "尔子田里乃",
	niwatari_kutaka: "庭渡久侘歌",
	okazaki_yumemi: "冈崎梦美",
	okunoda_miyoi: "奥野田美宵",
	onozuka_komachi: "小野塚小町",
	orange: "奥莲姬",
	patchouli_knowledge: "帕秋莉·诺蕾姬",
	reisen: "铃仙二号",
	reisen_udongein_inaba: "铃仙·优昙华院·因幡",
	reiuji_utsuho: "灵乌路空",
	remilia_scarlet: "蕾米莉亚·斯卡蕾特",
	rika: "里香",
	ringo: "铃瑚",
	rumia: "露米娅",
	ruukoto: "留琴",
	saigyouji_yuyuko: "西行寺幽幽子",
	sakata_nemuno: "坂田合欢",
	sara: "萨拉",
	sariel: "萨丽爱尔",
	satsuki_rin: "冴月麟",
	seiran: "清兰",
	sekibanki: "赤蛮奇",
	shameimaru_aya: "射命丸文",
	shiki_eiki: "四季映姬",
	shinki: "神绮",
	soga_no_tojiko: "苏我屠自古",
	star_sapphire: "斯塔萨菲雅",
	sunny_milk: "桑尼米尔克",
	tamatsukuri_misumaru: "玉造魅须丸",
	tatara_kogasa: "多多良小伞",
	teireida_mai: "丁礼田舞",
	tenkyuu_chimata: "天弓千亦",
	tokiko: "朱鹭子",
	toutetsu_yuuma: "饕餮尤魔",
	toyosatomimi_no_miko: "丰聪耳神子",
	tsukumo_benben: "九十九弁弁",
	tsukumo_yatsuhashi: "九十九八桥",
	usami_sumireko: "宇佐见堇子",
	ushizaki_urumi: "牛崎润美",
	wakasagihime: "若鹭姬",
	watari_nina: "渡里妮娜",
	watatsuki_no_toyohime: "绵月丰姬",
	watatsuki_no_yorihime: "绵月依姬",
	wriggle_nightbug: "莉格露·奈特巴格",
	yagokoro_eirin: "八意永琳",
	yakumo_ran: "八云蓝",
	yakumo_yukari: "八云紫",
	yamashiro_takane: "山城高岭",
	yasaka_kanako: "八坂神奈子",
	yatadera_narumi: "矢田寺成美",
	yorigami_shion: "依神紫苑",
	yuki: "雪",
	yumeko: "梦子",
	mystia_lorelei: "米斯蒂娅·萝蕾拉",
	kurodani_yamame: "黑谷山女",
	mitsugashira_enoko: "三头慧之子",
	mizuhashi_parsee: "水桥帕露西",
	morichika_rinnosuke: "森近霖之助",
	nippaku_zanmu: "日白残无",
	son_biten: "孙美天",
	sukuna_shinmyoumaru: "少名针妙丸",
	tenkajin_chiyari: "天火人血枪",
	toramaru_shou: "寅丸星",
	usami_renko: "宇佐见莲子",
	yomotsu_hisami: "豫母都日狭美",
	yorigami_jyoon: "依神女苑",
	yuiman_asama: "维缦·浅间",
	zun: "zun",
};

ws.onopen = () => {
	console.log("✅ WebSocket 已连接");
}; // 声明连接成功

ws.onmessage = (event) => {
	// 接收事件发生？
	try {
		const data = JSON.parse(event.data); // 解析接收的数据，转化为js格式的字符串
		console.log("📩 收到消息:", data);

		switch (
			data.type // switch语句，根据不同的type类型，调用不同的更新函数
		) {
			case "image":
				updateImage(data.image); // 若是图片，执行图片更新函数
				break; // 跳出switch语句
			case "top5":
				updateTop5(data.results);
				break;
			case "timer":
				updateTimer(data);
				break;
			case "game_state_update": // 游戏状态更新
				updateGameState(data.payload);
				break;
			case "final_results": // 最终结果
				console.log("最终结果:", data.payload);
				if (data.payload && data.payload.results) {
					// (true = 强制显示)
					updateTop5(data.payload.results, true);
				}
				break;
			// 若上述全不匹配，执行默认逻辑
			default:
				console.log("⚙️ 其它类型消息:", data);
				break;
		}
		// 若上面try失败，则启动catch，捕获解析错误
	} catch (err) {
		console.error("❌ JSON 解析错误:", err, event.data);
	}
};

ws.onclose = () => {
	console.warn("🔌 WebSocket 已断开，尝试重连...");
	setTimeout(() => location.reload(), 2000);
};

// === 各类更新函数 ===

// 游戏状态更新
function updateGameState(state) {
	const phase = state.phase;

	const targetContainer = document.getElementById("target-image-container");
	const targetImage = document.getElementById("target-image");

	if (phase === "IDLE") {
		roundTitle.textContent = "游戏已重置";
		if (targetContainer) {
			targetContainer.style.display = "none";
		}
	} else if (state.round > 0) {
		roundTitle.textContent = `第 ${state.round} 轮 (第 ${state.try_num} 次尝试) - 请画出: ${state.target_name}`;
		if (targetContainer && targetImage && state.target_label) {
			targetImage.src = `../images/chr/${state.target_label}_small.png`;
			targetContainer.style.display = "block";
		}
	}

	// 当进入 WAITING 阶段时 (意味着新一轮或新尝试)
	// 我们需要重置画布和 Top5
	if (phase === "WAITING" || phase === "IDLE") {
		// 1. 重置画布
		// (我们依赖 "image" 消息来清空,
		//  后端 clear_canvas_and_broadcast 会发送)
		// (或者, 我们在这里手动重置)
		imageDisplay.src = "../images/others/empty-canvas.png";

		// 2. 重置 Top5 列表 (复用 timer-reset 逻辑)
		resetTop5Display();

		// 3. IDLE 阶段隐藏目标图片, WAITING 阶段应确保显示
		if (phase === "WAITING" && targetContainer) {
			targetContainer.style.display = "block";
		}
	}
}

// timer更新
function updateTimer(timerData) {
	// 获取timedata.value的值，若无则赋值为"?"
	const value = timerData.value ?? "?";

	// 2. 判断 timerData.by 的操作类型
	// 如果是 "reset"（重置操作），显示重置信息，并设置蓝色文字，同时重置识别结果
	if (timerData.by === "reset") {
		timerDisplay.textContent = `⏱ 定时器重置：${value}s`;
		timerDisplay.style.color = "#0066cc";

		currentTimerValue = value;

		// 重置识别结果
		resetTop5Display();
	}
	// 如果是 "countdown"（倒计时操作），显示剩余时间，并根据时间设置文字颜色
	else if (timerData.by === "countdown") {
		currentTimerValue = timerData.value;

		let timerDataMinute = Math.floor(timerData.value / 60);
		let timerDataSecond = timerData.value % 60;
		// 格式化为两位数（补零）
		const timerDataMinuteStr = String(timerDataMinute).padStart(2, "0");
		const timerDataSecondStr = String(timerDataSecond).padStart(2, "0");
		// 根据剩余时间量判断文本颜色
		if (timerData.value <= 30 && timerData.value > 0) {
			timerDisplay.style.color = "red";

			// 倒计时30秒时，主动隐藏结果
			if (timerData.value === 30) {
				console.log("⏳ 30秒，隐藏结果...");
				hideTop5Results(); // 隐藏结果
			}
		} else {
			timerDisplay.style.color = "black";
		}
		timerDisplay.textContent = `⏳${timerDataMinuteStr}:${timerDataSecondStr}`;

		// 其他情况（未指定操作类型），仅显示时间
	} else {
		timerDisplay.textContent = `⏳${value}s`;
	}
}

// 重置 Top5 的辅助函数
function resetTop5Display() {
	for (let rank = 1; rank <= 5; rank++) {
		const NameCN = document.getElementById(`result-top${rank}-nameCN`);
		const NameEN = document.getElementById(`result-top${rank}-nameEN`);
		const Similarity = document.getElementById(
			`result-top${rank}-similarity-value`
		);
		const image = document.getElementById(`result-top${rank}-image`);

		if (NameCN) NameCN.innerText = "？？？";
		if (NameEN) NameEN.innerText = "？？？";
		if (Similarity) Similarity.innerText = "??%";
		if (image) image.src = `../images/chr/satsuki_rin_unknown.png`;
	}
}

// 隐藏 Top5 的辅助函数
function hideTop5Results() {
	for (let rank = 1; rank <= 5; rank++) {
		const NameCN = document.getElementById(`result-top${rank}-nameCN`);
		const NameEN = document.getElementById(`result-top${rank}-nameEN`);
		const Similarity = document.getElementById(
			`result-top${rank}-similarity-value`
		);
		const image = document.getElementById(`result-top${rank}-image`);

		if (NameCN) NameCN.innerText = "？？？";
		if (NameEN) NameEN.innerText = "？？？";
		if (Similarity) Similarity.innerText = "??%";
		// (使用 truth.jpg)
		if (image) image.src = `../images/others/truth.jpg`;
	}
}

// 画布更新
function updateImage(imageObj) {
	// 1. 检查传入的 imageObj 是否有效（避免空值或缺少 base64 数据），若无效直接退出函数
	if (!imageObj) return;

	// 处理空 base64 (来自后端的 clear_canvas)
	if (!imageObj.base64 || imageObj.base64.length < 10) {
		imageDisplay.src = "../images/others/empty-canvas.png";
		return;
	}

	// 2.转换数据为浏览器可识别的 data URL 格式
	const src = `data:${imageObj.type};base64,${imageObj.base64}`;

	// 3. 构建展示画布的 data URL，并将其赋值给 imageDisplay 元素的 src 属性，从而更新显示的图片
	imageDisplay.src = src;
}

/* top5数据更新函数，最难懂的一集
示例json
    {
        "type": "top5",
        "results": [
            {
                "label": "saigyouji_yuyuko",
                "score": 0.9818522930145264
            },
            {
                "label": "onozuka_komachi",
                "score": 0.007961973547935486
            },
            {
                "label": "konpaku_youmu",
                "score": 0.004716822877526283
            },
            {
                "label": "maribel_hearn",
                "score": 0.0012106532230973244
            },
            {
                "label": "kaku_seiga",
                "score": 0.0011601087171584368
            }
        ]
    }
*/
function updateTop5(results, forceShow = false) {
	// 参数验证：确保传入的 results 是一个数组，否则直接结束函数运行
	if (!Array.isArray(results)) return;

	if (currentTimerValue <= 30 && !forceShow) {
		// (我们依赖后端的门控广播
		//  和 updateTimer 中的 hideTop5Results())
		// (这个函数现在不应该被调用，但作为保险)
		console.warn("updateTop5 在 <= 30s 时被调用，已忽略。");
		return;
	}

	// 定义格式化名称的函数
	function formatName(label) {
		return label
			.replace(/_/g, " ") // 下划线替换为空格
			.replace(/\b\w/g, (c) => c.toUpperCase()); // 每个单词首字母大写
	}

	// 定义英文名转变为中文名的函数
	function nameTranslate(name) {
		return nameDataCN[name] || "未知人物";
	}

	// 遍历结果数组
	results.forEach((item, Index) => {
		const rank = Index + 1; // 计算排名（从1开始）

		// 抓取前端的元素
		const NameCN = document.getElementById(`result-top${rank}-nameCN`);
		const NameEN = document.getElementById(`result-top${rank}-nameEN`);
		const Similarity = document.getElementById(
			`result-top${rank}-similarity-value`
		);
		const image = document.getElementById(`result-top${rank}-image`);

		// 改变元素内容
		if (NameCN !== null && NameCN !== undefined) {
			// 设置中文名，使用nameTranslate函数，额外加了个条件判断原始英文名在数据库里，一般用不到
			NameCN.innerHTML = nameTranslate(item.label);
		}
		if (NameEN) NameEN.innerText = formatName(item.label); // 设置英文名，通过formatName函数把下划线转空格，并首字母大写
		if (Similarity)
			Similarity.innerText = `${(item.score * 100).toFixed(1)}%`; // 设置相似度，保留一位小数并添加百分号
		
		if (image) {
			const targetSrc = `../images/chr/${item.label}_small.png`;
			const fallbackSrc = `../images/chr/satsuki_rin_unknown.png`;

			// 建立临时 Image 对象检测缓存
			const testImg = new Image();
			testImg.src = targetSrc;

			if (testImg.complete && testImg.naturalWidth !== 0) {
				// 已缓存，直接显示目标图片
				image.src = targetSrc;
			} else {
				// 未缓存，先显示占位图，再加载
				// 防止图片耗时加载时显示错误图标
				image.src = fallbackSrc;
				testImg.onload = () => {
					image.src = targetSrc;
				};
			}
		}
	});
}

/*
//来自后端的示例
const ws = new WebSocket("/ws/listener")

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "image") {
        console.log("Receiving image ...");
        // ...
    } else if (data.type === "top5") {
        console.log("Receiving top5 ...")
        // ...
    }
};
*/
