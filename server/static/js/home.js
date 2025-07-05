document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();
});

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;

  const logo = document.getElementById("clipnote-logo");

  if (!toggle || !logo) return;

  if (window.lucide) lucide.createIcons();

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    body.classList.add("light-mode");
    toggle.checked = true;
    logo.src = logo.dataset.light;
  } else {
    logo.src = logo.dataset.dark;
  }

  toggle.addEventListener("change", () => {
    const isLight = toggle.checked;
    body.classList.toggle("light-mode", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
    logo.src = isLight ? logo.dataset.light : logo.dataset.dark;
  });
}
