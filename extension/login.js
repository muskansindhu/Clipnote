document.addEventListener("DOMContentLoaded", () => {
  const loginLink = document.getElementById("login-link");

  chrome.storage?.local.get("clipnote_token", (result) => {
    if (result.clipnote_token) {
      window.location.href = chrome.runtime.getURL("popup.html");
    } else {
      document.querySelector(".login-container").style.display = "flex";
    }
  });

  if (window.CONFIG && window.CONFIG.BASE_URL) {
    const loginUrl = window.CONFIG.BASE_URL + "/login";

    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: loginUrl });
    });
  } else {
    console.error("CONFIG not loaded properly");
  }
});
