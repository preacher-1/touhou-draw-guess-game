// ChatGPT写的
// 抓取数据环节
const ws = new WebSocket(`ws://${location.host}/ws/listener`);       // 初始定义websocket链接？
const imageDisplay = document.getElementById("canvas");       // 获取展示画布的元素canvas
const timerDisplay = document.getElementById("timer");                  // 获取定时器的元素timer

/* 写完但是用不到了的穷举抓取环节
const resultTop1_NameCN = document.getElementById("result-top1-nameCN");    // 获取top1结果的中文名称元素
const resultTop1_NameEN = document.getElementById("result-top1-nameEN");    // 获取top1结果的英文名称元素
const resultTop1_Similarity = document.getElementById("result-top1-similarity-value");  // 获取top1结果的相似度数据元素
const resultTop2_NameCN = document.getElementById("result-top2-nameCN");    // 获取top2结果
const resultTop2_NameEN = document.getElementById("result-top2-nameEN");
const resultTop2_imilarity = document.getElementById("result-top2-similarity-value");
const resultTop3_NameCN = document.getElementById("result-top3-nameCN");    // 获取top3结果
const resultTop3_NameEN = document.getElementById("result-top3-nameEN");
const resultTop3_Similarity = document.getElementById("result-top3-similarity-value");
const resultTop4_NameCN = document.getElementById("result-top4-nameCN");    // 获取top4结果
const resultTop4_NameEN = document.getElementById("result-top4-nameEN");
const resultTop4_Similarity = document.getElementById("result-top4-similarity-value");
const resultTop5_NameCN = document.getElementById("result-top5-nameCN");    // 获取top5结果
const resultTop5_NameEN = document.getElementById("result-top5-nameEN");
const resultTop5_Similarity = document.getElementById("result-top5-similarity-value");
*/

// 这些是假装从后端发来的数据
    /*
    const sampleData = {
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

    /*
    const sampleData = {
        "type": "image",
            "image": {
                "type": "image/png",
                "base64": "iVBORw0KGgoAAAANSUhEUgAA..."
            }
        }
    */

    //  const sampleData = {"type": "timer", "value": 90, "by": "reset"}
    //  const sampleData = {"type": "timer", "value": (剩余时间), "by": "countdown"}



ws.onopen = () => {
    console.log("✅ WebSocket 已连接");
};       // 声明连接成功

ws.onmessage = (event) => {      // 接收事件发生？
    try {
    const data = JSON.parse(event.data);     // 解析接收的数据，转化为js格式的字符串
    console.log("📩 收到消息:", data);

    switch (data.type) {        // switch语句，根据不同的type类型，调用不同的更新函数
        case "image":
            updateImage(data.image);        // 若是图片，执行图片更新函数
            break;      // 跳出switch语句
        case "top5":
            updateTop5(data.results);
            break;
        case "timer":
            updateTimer(data);
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

// timer更新
function updateTimer(timerData) {
    // 1.获取timedata.value的值，若无则赋值为"?"
    const value = timerData.value ?? "?";

    // 2. 判断 timerData.by 的操作类型
    // 如果是 "reset"（重置操作），显示重置信息，并设置蓝色文字，同时重置识别结果
    if (timerData.by === "reset") {
        timerDisplay.textContent = `⏱ 定时器重置：${value}s`;
        timerDisplay.style.color = "#0066cc";

        // 重置识别结果
        for (let rank = 1; rank <= 5; rank++) {

            // 抓取前端的元素
            const NameCN = document.getElementById(`result-top${rank}-nameCN`);
            const NameEN = document.getElementById(`result-top${rank}-nameEN`);
            const Similarity = document.getElementById(`result-top${rank}-similarity-value`);
            const image = document.getElementById(`result-top${rank}-image`);

            // 改变元素内容
            NameCN.innerText = "？？？"; // 设置中文名为未知
            NameEN.innerText = "？？？"; // 设置英文名为未知
            Similarity.innerText = "??%"; // 设置相似度为未知
            image.src = `../images/chr/satsuki_rin_unknown.png`; // 设置图片路径为冴月麟的剪影，没有原因，因为我喜欢这么做）
        }


    // 如果是 "countdown"（倒计时操作），显示剩余时间，并根据时间设置文字颜色
    } else if (timerData.by === "countdown") {
        let timerDataMinute = Math.floor(timerData.value / 60);
        let timerDataSecond = timerData.value % 60;
        // 格式化为两位数（补零）
        const timerDataMinuteStr = String(timerDataMinute).padStart(2, '0');
        const timerDataSecondStr = String(timerDataSecond).padStart(2, '0');
        // 根据剩余时间量判断文本颜色
        if (timerData.value <= 30) {
            timerDisplay.style.color = "red";
        } else {
            timerDisplay.style.color = "black";
        }
        timerDisplay.textContent = `⏳${timerDataMinuteStr}:${timerDataSecondStr}`;

    // 其他情况（未指定操作类型），仅显示时间
    } else {
        timerDisplay.textContent = `⏳${value}s`;
    }
}

// 画布更新
function updateImage(imageObj) {

    // 1. 检查传入的 imageObj 是否有效（避免空值或缺少 base64 数据），若无效直接退出函数
    if (!imageObj || !imageObj.base64) return;

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
function updateTop5(results) {
    // 参数验证：确保传入的 results 是一个数组，否则直接结束函数运行
    if (!Array.isArray(results)) return;
    
    // 定义格式化名称的函数
    function formatName(label) {
        return label
            .replace(/_/g, ' ') // 下划线替换为空格
            .replace(/\b\w/g, c => c.toUpperCase()); // 每个单词首字母大写
    }

    // 遍历结果数组
    results.forEach((item, Index) => {
        const rank = Index + 1; // 计算排名（从1开始）

        // 抓取前端的元素
        const NameCN = document.getElementById(`result-top${rank}-nameCN`);
        const NameEN = document.getElementById(`result-top${rank}-nameEN`);
        const Similarity = document.getElementById(`result-top${rank}-similarity-value`);
        const image = document.getElementById(`result-top${rank}-image`);

        if (timerDisplay <= 30) {   // 如果定时器小于等于30秒，隐藏结果
            // 改变元素内容
            NameCN.innerText = "？？？"; // 设置中文名为未知
            NameEN.innerText = "？？？"; // 设置英文名为未知
            Similarity.innerText = "??%"; // 设置相似度为未知
            image.src = `../images/chr/truth`; // 设置图片路径为渡里妮娜。“此乃真实！！”
        } else {
            // 改变元素内容
            NameCN.innerText = "？？？"; // 设置中文名，暂时无法实现
            NameEN.innerText = formatName(item.label); // 设置英文名，通过函数把下划线转空格，并首字母大写
            Similarity.innerText = `${(item.score * 100).toFixed(1)}%`; // 设置相似度，保留一位小数并添加百分号
            image.src = `../images/chr/${item.label}_small.png`; // 设置图片路径
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