// The service worker has no `window`; config.js assigns to it.
self.window = self;
importScripts("config.js");

chrome.runtime.onMessageExternal.addListener(function (
  request,
  sender,
  sendResponse
) {
  if (request.type === "SET_TOKEN") {
    const token = request.jwt;
    console.log("Received token from web page:");

    chrome.storage.local.set({ clipnote_token: token }, function () {
      if (chrome.runtime.lastError) {
        console.error("Error setting token:", chrome.runtime.lastError.message);
        sendResponse({ ok: false });
      } else {
        console.log("Token successfully stored in extension local storage.");
        sendResponse({ ok: true });
      }
    });
    return true;
  }
});


/* ---------- Global shortcut: save this moment and let AI write the note ---------- */

/** Runs inside the YouTube tab. Reads the moment from the video element itself. */
function readMoment() {
  const video = document.querySelector("video.html5-main-video") || document.querySelector("video");
  if (!video || !window.location.href.includes("youtube.com/")) return null;
  const total = Math.floor(video.currentTime);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  const clock = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  const title = document.title.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "");
  return { url: window.location.href, title, clock };
}

/**
 * Runs inside the tab. Shows a small note panel above the video, including in full screen
 * (it is attached to the fullscreen element). Saving is delegated to the service worker.
 */
function showCapturePanel(moment) {
  const existing = document.getElementById("clipnote-capture");
  if (existing) {
    existing.shadowRoot.querySelector("textarea").focus();
    return;
  }

  const video = document.querySelector("video.html5-main-video") || document.querySelector("video");
  const wasPlaying = Boolean(video && !video.paused);
  if (wasPlaying) video.pause();

  const host = document.createElement("div");
  host.id = "clipnote-capture";
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .panel {
        pointer-events: auto; position: absolute; top: 9%; left: 50%; transform: translateX(-50%);
        width: min(440px, calc(100vw - 32px)); padding: 16px; border-radius: 12px;
        background: #1b1a17; color: #ece8dd; border: 1px solid #3d3a33;
        font: 400 14px/1.4 Inter, system-ui, sans-serif; box-shadow: 0 24px 70px rgba(0,0,0,.65);
      }
      .row { display: flex; align-items: center; gap: 10px; }
      .mark { width: 22px; height: 22px; flex: none; }
      .stamp { font: 500 13px "JetBrains Mono", ui-monospace, Menlo, monospace; color: #ff6b4a; }
      .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #aaa595; font-size: 13px; }
      textarea {
        display: block; width: 100%; height: 96px; margin-top: 12px; padding: 10px 12px; resize: none;
        font: 400 18px/1.3 Newsreader, Georgia, serif; color: #ece8dd; background: #151412;
        border: 1px solid #3d3a33; border-radius: 8px; outline: none;
      }
      textarea:focus { border-color: #ece8dd; }
      textarea::placeholder { color: #77725f; }
      .actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
      .hint { flex: 1; color: #77725f; font-size: 12px; }
      button {
        font: 600 14px Inter, system-ui, sans-serif; padding: 8px 14px; border-radius: 8px; cursor: pointer;
        border: 1px solid #3d3a33; background: transparent; color: #ece8dd;
      }
      button.primary { background: #ece8dd; color: #151412; border-color: #ece8dd; }
      button:disabled { opacity: .45; cursor: default; }
      .status { margin-top: 10px; font-size: 13px; color: #6cc38b; min-height: 18px; }
      .status.error { color: #ff7a70; }
    </style>
    <div class="panel" role="dialog" aria-label="Clipnote">
      <div class="row">
        <svg class="mark" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="7" fill="#ece8dd"/><path d="M8 12h16M8 20h9" stroke="#151412" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="23" cy="20" r="2.4" fill="#ff6b4a"/></svg>
        <span class="stamp"></span>
        <span class="title"></span>
      </div>
      <textarea placeholder="Write a note, or leave it empty and let AI write it" aria-label="Note"></textarea>
      <div class="actions">
        <span class="hint">Enter saves</span>
        <button type="button" class="ai">Let AI write</button>
        <button type="button" class="primary save">Save note</button>
      </div>
      <div class="status" role="status"></div>
    </div>`;
  root.querySelector(".stamp").textContent = moment.clock;
  root.querySelector(".title").textContent = moment.title;
  const area = root.querySelector("textarea");
  const status = root.querySelector(".status");
  const buttons = root.querySelectorAll("button");
  let busy = false;

  const mount = () => (document.fullscreenElement || document.body).appendChild(host);
  mount();
  document.addEventListener("fullscreenchange", mount);
  setTimeout(() => area.focus(), 0);

  const close = () => {
    document.removeEventListener("fullscreenchange", mount);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", swallow, true);
    window.removeEventListener("keypress", swallow, true);
    host.remove();
    if (wasPlaying && video) video.play();
  };

  const save = (text) => {
    if (busy) return;
    busy = true;
    buttons.forEach((button) => (button.disabled = true));
    status.className = "status";
    status.textContent = "Saving…";
    chrome.runtime.sendMessage({ type: "CLIPNOTE_SAVE", moment, notes: text }, (response) => {
      if (response && response.ok) {
        status.textContent = text ? `Saved at ${moment.clock}` : `Saved at ${moment.clock}. AI is writing the note…`;
        setTimeout(close, 1100);
      } else {
        busy = false;
        buttons.forEach((button) => (button.disabled = false));
        status.className = "status error";
        status.textContent = (response && response.error) || "Could not save. Try again.";
      }
    });
  };

  // YouTube listens for single-key shortcuts (space, f, k...). Keep them away while typing here.
  const inside = (event) => event.composedPath().includes(host);
  const swallow = (event) => inside(event) && event.stopImmediatePropagation();
  function onKey(event) {
    if (!inside(event)) return;
    event.stopImmediatePropagation();
    if (event.key === "Escape") close();
    else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save(area.value.trim());
    }
  }
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", swallow, true);
  window.addEventListener("keypress", swallow, true);

  root.querySelector(".save").addEventListener("click", () => save(area.value.trim()));
  root.querySelector(".ai").addEventListener("click", () => save(""));
}

/** Runs inside the tab. A brief message for cases where the panel cannot open. */
function showToast(message) {
  const host = document.fullscreenElement || document.body;
  document.getElementById("clipnote-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "clipnote-toast";
  toast.textContent = message;
  toast.style.cssText =
    "position:fixed;top:28px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
    "padding:10px 16px;border-radius:8px;background:#1b1a17;color:#ece8dd;" +
    "border:1px solid #3d3a33;border-left:3px solid #ff7a70;" +
    "font:500 14px/1.3 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5);pointer-events:none";
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function toast(tabId, message) {
  return chrome.scripting
    .executeScript({ target: { tabId }, func: showToast, args: [message] })
    .catch((error) => console.error("Clipnote toast failed:", error));
}

async function openCapture(tab) {
  if (!tab || tab.id === undefined) return;
  const { clipnote_token: token } = await chrome.storage.local.get("clipnote_token");
  if (!token) {
    await toast(tab.id, "Clipnote: sign in first (click the extension icon)");
    return;
  }

  let moment;
  try {
    [{ result: moment }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readMoment });
  } catch (error) {
    console.error("Clipnote could not read the page:", error);
  }
  if (!moment) {
    await toast(tab.id, "Clipnote: open a YouTube video first");
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showCapturePanel, args: [moment] });
}

async function saveMoment(moment, notes) {
  const { clipnote_token: token } = await chrome.storage.local.get("clipnote_token");
  if (!token) return { ok: false, error: "Signed out. Click the extension icon to sign in." };
  try {
    const response = await fetch(`${CONFIG.BASE_URL}/add-notes`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "text/plain" },
      body: JSON.stringify({
        videoUrl: moment.url,
        videoTitle: moment.title,
        currentTimeStamp: moment.clock,
        notes,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ok: true };
  } catch (error) {
    console.error("Clipnote save failed:", error);
    return { ok: false, error: "Could not reach Clipnote. Try again." };
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "capture-note") return;
  openCapture(tab).catch((error) => {
    // Visible even when nothing can be drawn on the page.
    console.error("Clipnote capture failed:", error);
    chrome.action.setBadgeBackgroundColor({ color: "#b3261e" });
    chrome.action.setBadgeText({ text: "!" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CLIPNOTE_SAVE" || sender.id !== chrome.runtime.id) return;
  saveMoment(message.moment, message.notes).then(sendResponse);
  return true;
});
