document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();
  insertDashboardIconIfLoggedIn();
});

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;
  const logo = document.getElementById("clipnote-logo");

  if (!toggle || !logo) return;

  if (window.lucide) lucide.createIcons();

  const applyTheme = (isLight) => {
    body.classList.toggle("light-mode", isLight);
    toggle.checked = isLight;
    localStorage.setItem("theme", isLight ? "light" : "dark");

    document
      .querySelectorAll("img[data-theme-switchable='true']")
      .forEach((img) => {
        img.src = isLight ? img.dataset.light : img.dataset.dark;
      });
  };

  const savedTheme = localStorage.getItem("theme");
  applyTheme(savedTheme === "light");

  toggle.addEventListener("change", () => {
    applyTheme(toggle.checked);
  });
}

function insertDashboardIconIfLoggedIn() {
  const token = localStorage.getItem("clipnote_token");
  if (!token) return;

  const placeholder = document.getElementById("dashboard-icon-placeholder");
  if (!placeholder) return;

  placeholder.src = "/static/assets/dashboard.png";
  placeholder.alt = "Dashboard";
  placeholder.classList.add("dashboard-icon");
  placeholder.style.display = "inline-block";
  placeholder.style.cursor = "pointer";

  placeholder.setAttribute("data-dark", "/static/assets/dashboard.png");
  placeholder.setAttribute("data-light", "/static/assets/dashboard-light.png");
  placeholder.setAttribute("data-theme-switchable", "true");

  placeholder.src =
    localStorage.getItem("theme") === "light"
      ? "/static/assets/dashboard-light.png"
      : "/static/assets/dashboard.png";

  placeholder.addEventListener("click", () => {
    window.location.href = "/dashboard";
  });
}
