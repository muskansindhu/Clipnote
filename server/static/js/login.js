document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();

  const token = localStorage.getItem("clipnote_token");
  if (token) {
    window.location.href = "/dashboard";
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
    window.location.href = "/dashboard";
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
