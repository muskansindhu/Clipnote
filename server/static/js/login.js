document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();

  const EXT_ID = "bdolajikajidpcodloegllkneeochbaf";

  const token = localStorage.getItem("clipnote_token");
  if (token) {
    window.location.href = "/dashboard";
    return;
  }

  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = form.username.value;
    const password = form.password.value;

    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      errorMsg.style.display = "block";
      errorMsg.textContent = "Invalid credentials. Please try again.";
      return;
    }

    const { access_token } = await res.json();
    localStorage.setItem("clipnote_token", access_token);

    if (window.chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        EXT_ID,
        { type: "SET_TOKEN", jwt: access_token },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to send token to extension:",
              chrome.runtime.lastError.message
            );
          } else if (!response?.ok) {
            console.warn("Extension responded but not ok:", response);
          } else {
            console.log("Token delivered to extension");
          }
          window.location.href = "/dashboard";
        }
      );
    } else {
      window.location.href = "/dashboard";
    }
  });
});

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;

  if (!toggle) return;

  if (window.lucide) lucide.createIcons();

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    body.classList.add("light-mode");
    toggle.checked = true;
  }

  toggle.addEventListener("change", () => {
    const isLight = toggle.checked;
    body.classList.toggle("light-mode", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}
