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
