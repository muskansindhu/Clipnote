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

/** Runs inside the YouTube tab. Returns what the popup would read, from the video element itself. */
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

/** Runs inside the tab. Appends to the fullscreen element so the toast is visible in full screen. */
function showToast(message, tone) {
  const host = document.fullscreenElement || document.body;
  document.getElementById("clipnote-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "clipnote-toast";
  toast.textContent = message;
  const colour = tone === "error" ? "#ff7a70" : "#ff6b4a";
  toast.style.cssText =
    "position:fixed;top:28px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
    "padding:10px 16px;border-radius:8px;background:#1b1a17;color:#ece8dd;" +
    `border:1px solid #3d3a33;border-left:3px solid ${colour};` +
    "font:500 14px/1.3 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5);" +
    "pointer-events:none;transition:opacity .2s";
  host.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

function toast(tabId, message, tone) {
  return chrome.scripting
    .executeScript({ target: { tabId }, func: showToast, args: [message, tone] })
    .catch((error) => console.error("Clipnote toast failed:", error));
}

async function markMoment(tab) {
  if (!tab || tab.id === undefined) return;
  const { clipnote_token: token } = await chrome.storage.local.get("clipnote_token");
  if (!token) {
    await toast(tab.id, "Clipnote: sign in first (click the extension icon)", "error");
    return;
  }

  let moment;
  try {
    [{ result: moment }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readMoment });
  } catch (error) {
    console.error("Clipnote could not read the page:", error);
  }
  if (!moment) {
    await toast(tab.id, "Clipnote: open a YouTube video first", "error");
    return;
  }

  try {
    const response = await fetch(`${CONFIG.BASE_URL}/add-notes`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "text/plain" },
      body: JSON.stringify({
        videoUrl: moment.url,
        videoTitle: moment.title,
        currentTimeStamp: moment.clock,
        notes: "",
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await toast(tab.id, `Saved ${moment.clock}. AI is writing the note…`, "ok");
  } catch (error) {
    console.error("Clipnote save failed:", error);
    await toast(tab.id, "Clipnote: could not save this moment", "error");
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "mark-moment") void markMoment(tab);
});
