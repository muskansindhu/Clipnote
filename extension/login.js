document.addEventListener("DOMContentLoaded", function () {
  document.querySelector(".login-container").style.display = "none";

  chrome.storage?.local.get("clipnote_token", (result) => {
    if (result.clipnote_token) {
      window.location.href = chrome.runtime.getURL("popup.html");
    } else {
      document.querySelector(".login-container").style.display = "flex";
    }
  });
});

document.getElementById("login-btn").addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("error-msg");

  try {
    const res = await fetch("http://127.0.0.1:5001/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      errorMsg.style.display = "block";
      return;
    }

    const { access_token } = await res.json();
    localStorage.setItem("clipnote_token", access_token);

    chrome.storage?.local.set({ clipnote_token: access_token }, () => {
      console.log("Token saved in chrome.storage.local");
    });

    window.postMessage(
      {
        type: "UPDATE_EXTENSION_STORAGE",
        payload: { clipnote_token: access_token },
      },
      "*"
    );

    window.location.href = chrome.runtime.getURL("popup.html");
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Error during login";
    errorMsg.style.display = "block";
  }
});
