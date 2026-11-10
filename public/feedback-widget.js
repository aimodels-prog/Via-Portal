(function () {
  "use strict";

  if (window.__viaFeedbackWidgetLoaded) return;

  var script = document.currentScript;
  var appSlug = script && script.dataset.appSlug;
  if (!appSlug) return;

  var allowedHosts = (script.dataset.allowedHosts || "")
    .split(",")
    .map(function (host) {
      return host.trim().toLowerCase();
    })
    .filter(Boolean);
  if (allowedHosts.length && allowedHosts.indexOf(window.location.hostname.toLowerCase()) === -1) {
    return;
  }

  window.__viaFeedbackWidgetLoaded = true;

  var portalOrigin = (script.dataset.portalOrigin || "https://portal.via-int.com").replace(
    /\/$/,
    "",
  );
  var appName = script.dataset.appName || "this application";
  var host = document.createElement("div");
  host.id = "via-feedback-widget";
  host.style.position = "fixed";
  host.style.right = "20px";
  host.style.bottom = "20px";
  host.style.zIndex = "2147483000";
  document.body.appendChild(host);

  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    '*{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}' +
    ".trigger{height:44px;border:0;border-radius:8px;background:#0f5b99;color:#fff;padding:0 16px;display:inline-flex;align-items:center;gap:9px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 12px 30px rgba(8,23,47,.24)}" +
    ".trigger:hover{background:#073e73}.bubble{width:17px;height:14px;border:2px solid currentColor;border-radius:4px;position:relative;display:inline-block}" +
    '.bubble:after{content:"";position:absolute;left:2px;bottom:-5px;width:6px;height:6px;border-left:2px solid currentColor;transform:skewY(-35deg)}' +
    ".overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(8,23,47,.54);display:none;place-items:center;padding:16px;backdrop-filter:blur(4px)}" +
    ".overlay.open{display:grid}.dialog{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;border:1px solid #dbe5f2;border-radius:8px;background:#fff;color:#08172f;box-shadow:0 30px 90px rgba(8,23,47,.3)}" +
    ".head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid #e8eef6}" +
    ".eyebrow{margin:0 0 4px;color:#0f5b99;font-size:11px;font-weight:800;text-transform:uppercase}.title{margin:0;font-size:20px;line-height:1.25;font-weight:700}" +
    ".close{width:36px;height:36px;border:1px solid #dbe5f2;border-radius:8px;background:#fff;color:#63708a;font-size:24px;line-height:1;cursor:pointer}.close:hover{color:#08172f}" +
    ".form{display:grid;gap:17px;padding:20px 22px}.field{display:grid;gap:7px;color:#10223d;font-size:13px;font-weight:700}" +
    "select,textarea{width:100%;border:1px solid #d8e3ef;border-radius:8px;background:#fff;color:#10223d;font-size:14px;font-weight:400;outline:none}select{height:42px;padding:0 11px}textarea{min-height:132px;padding:11px;line-height:1.55;resize:vertical}" +
    "select:focus,textarea:focus{border-color:#0f5b99;box-shadow:0 0 0 3px rgba(15,91,153,.1)}" +
    ".actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.count{color:#7a879a;font-size:11px}.submit,.done{height:40px;border:0;border-radius:8px;background:#0f5b99;color:#fff;padding:0 18px;font-size:13px;font-weight:700;cursor:pointer}.submit:hover,.done:hover{background:#073e73}.submit:disabled{cursor:not-allowed;opacity:.55}" +
    ".error{display:none;margin:0;border:1px solid rgba(233,40,36,.25);border-radius:8px;background:rgba(233,40,36,.05);color:#b51e1b;padding:9px 11px;font-size:13px;line-height:1.45}.error.show{display:block}" +
    ".success{display:none;padding:38px 22px;text-align:center}.success.show{display:block}.check{width:44px;height:44px;margin:0 auto 14px;border-radius:50%;background:#079a4a;color:#fff;display:grid;place-items:center;font-size:25px;font-weight:800}.success h3{margin:0;font-size:18px}.success p{margin:7px 0 20px;color:#63708a;font-size:13px}" +
    "@media(max-width:560px){:host{right:12px!important;bottom:12px!important}.trigger{width:44px;padding:0;justify-content:center}.trigger-label{display:none}.overlay{padding:10px}.dialog{max-height:calc(100vh - 20px)}}" +
    "</style>" +
    '<button class="trigger" type="button" aria-label="Open feedback"><span class="bubble" aria-hidden="true"></span><span class="trigger-label">Feedback</span></button>' +
    '<div class="overlay" role="presentation"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="via-feedback-title">' +
    '<div class="head"><div><p class="eyebrow"></p><h2 class="title" id="via-feedback-title">Share feedback</h2></div><button class="close" type="button" aria-label="Close feedback" title="Close">&times;</button></div>' +
    '<form class="form"><label class="field">Feedback type<select name="category"><option value="suggestion">Suggestion</option><option value="recommendation">Recommendation</option><option value="issue">Issue</option><option value="other">Other note</option></select></label>' +
    '<label class="field">What should we improve?<textarea name="message" maxlength="2000" required placeholder="Write your suggestion, recommendation, or note..."></textarea></label>' +
    '<p class="error" role="alert"></p><div class="actions"><span class="count">0/2000</span><button class="submit" type="submit" disabled>Send feedback</button></div></form>' +
    '<div class="success"><div class="check" aria-hidden="true">&#10003;</div><h3>Feedback sent</h3><p>Thank you. The portal administrators can now review it.</p><button class="done" type="button">Done</button></div>' +
    "</section></div>";

  var trigger = root.querySelector(".trigger");
  var overlay = root.querySelector(".overlay");
  var closeButton = root.querySelector(".close");
  var form = root.querySelector(".form");
  var textarea = root.querySelector("textarea");
  var submit = root.querySelector(".submit");
  var count = root.querySelector(".count");
  var error = root.querySelector(".error");
  var success = root.querySelector(".success");
  var done = root.querySelector(".done");
  root.querySelector(".eyebrow").textContent = appName;

  function open() {
    overlay.classList.add("open");
    window.setTimeout(function () {
      textarea.focus();
    }, 0);
  }

  function close() {
    overlay.classList.remove("open");
  }

  function reset() {
    form.reset();
    form.style.display = "grid";
    success.classList.remove("show");
    error.classList.remove("show");
    error.textContent = "";
    count.textContent = "0/2000";
    submit.disabled = true;
    submit.textContent = "Send feedback";
  }

  trigger.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  done.addEventListener("click", function () {
    close();
    reset();
  });
  overlay.addEventListener("mousedown", function (event) {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("open")) close();
  });
  textarea.addEventListener("input", function () {
    count.textContent = textarea.value.length + "/2000";
    submit.disabled = !textarea.value.trim();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!textarea.value.trim()) return;

    submit.disabled = true;
    submit.textContent = "Sending...";
    error.classList.remove("show");

    fetch(portalOrigin + "/api/feedback", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationSlug: appSlug,
        category: form.elements.category.value,
        message: textarea.value,
        pageUrl: window.location.href,
      }),
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (payload) {
            if (!response.ok) {
              var message =
                response.status === 401
                  ? "Your portal session has expired. Sign in to the VIA Portal, then try again."
                  : payload && payload.error
                    ? payload.error
                    : "Unable to send feedback.";
              throw new Error(message);
            }
          });
      })
      .then(function () {
        form.style.display = "none";
        success.classList.add("show");
      })
      .catch(function (requestError) {
        error.textContent = requestError.message || "Unable to send feedback.";
        error.classList.add("show");
        submit.disabled = false;
      })
      .finally(function () {
        submit.textContent = "Send feedback";
      });
  });
})();
