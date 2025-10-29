// passwordPrompt.js
window.promptPassword = async function(message = "请输入密码") {
  if (!document.getElementById("passwordModal")) {
    const html = `
      <div id="passwordModal" style="
        display:none; position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.4); justify-content:center; align-items:center;
      ">
        <div style="
          background:white; padding:20px; border-radius:8px;
          box-shadow:0 2px 10px rgba(0,0,0,0.3);
        ">
          <p id="passwordMessage"></p>
          <input type="password" id="passwordInput" style="width:200px; padding:6px;">
          <div style="margin-top:10px; text-align:right;">
            <button id="okBtn">确定</button>
            <button id="cancelBtn">取消</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);
  }

  const modal = document.getElementById("passwordModal");
  const msg = document.getElementById("passwordMessage");
  const input = document.getElementById("passwordInput");
  const ok = document.getElementById("okBtn");
  const cancel = document.getElementById("cancelBtn");

  msg.textContent = message;
  modal.style.display = "flex";
  input.value = "";
  input.focus();

  return new Promise(resolve => {
    ok.onclick = () => close(input.value);
    cancel.onclick = () => close(null);
    input.onkeydown = e => {
      if (e.key === "Enter") close(input.value);
      if (e.key === "Escape") close(null);
    };
    function close(value) {
      modal.style.display = "none";
      resolve(value);
    }
  });
}
