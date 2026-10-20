(function () {
  var script = document.currentScript;
  var origin = new URL(script.getAttribute("data-supportdesk") || script.src)
    .origin;
  var host = document.createElement("div");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "closed" });
  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}button{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border:0;border-radius:50%;background:#285e4f;color:white;box-shadow:0 5px 25px #18392e30;cursor:pointer;z-index:2147483000;font:26px Arial}button:focus-visible{outline:3px solid #a1bd8f;outline-offset:4px}iframe{position:fixed;bottom:96px;right:24px;width:385px;height:650px;max-height:calc(100dvh - 120px);max-width:calc(100vw - 32px);border:0;border-radius:14px;box-shadow:0 10px 55px #18392e35;z-index:2147483000}iframe[hidden]{display:none}@media(max-width:480px){iframe{right:16px;bottom:88px}button{right:18px;bottom:18px}}";
  root.appendChild(style);
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget";
  frame.title = "Customer support chat";
  frame.hidden = true;
  var button = document.createElement("button");
  button.textContent = "◌";
  button.setAttribute("aria-label", "Open customer support");
  button.setAttribute("aria-expanded", "false");
  button.onclick = function () {
    frame.hidden = !frame.hidden;
    button.textContent = frame.hidden ? "◌" : "×";
    button.setAttribute("aria-expanded", String(!frame.hidden));
    button.setAttribute(
      "aria-label",
      frame.hidden ? "Open customer support" : "Close customer support",
    );
    if (!frame.hidden) frame.focus();
  };
  root.appendChild(frame);
  root.appendChild(button);
})();
