document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();
  insertDashboardIconIfLoggedIn();
});

function setupThemeToggle() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const body = document.body;
  const logo = document.getElementById("clipnote-logo");

  if (!toggleBtn || !logo) return;

  const updateIcon = (isLight) => {
    const iconName = isLight ? "moon" : "sun";
    toggleBtn.innerHTML = `<i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>`;
    if (window.lucide) lucide.createIcons();
  };

  const applyTheme = (isLight) => {
    body.classList.toggle("light-mode", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");

    document
      .querySelectorAll("img[data-theme-switchable='true']")
      .forEach((img) => {
        img.src = isLight ? img.dataset.light : img.dataset.dark;
      });

    updateIcon(isLight);

    updateIcon(isLight);
  };

  const savedTheme = localStorage.getItem("theme");
  applyTheme(savedTheme === "light");

  toggleBtn.addEventListener("click", () => {
    const isLight = body.classList.contains("light-mode");
    applyTheme(!isLight);
  });
}

function insertDashboardIconIfLoggedIn() {
  const token = localStorage.getItem("clipnote_token");
  if (!token) return;

  // Dashboard Icon
  const dashboardBtn = document.getElementById("dashboard-btn");
  if (dashboardBtn) {
    dashboardBtn.style.display = "flex";
    dashboardBtn.addEventListener("click", () => {
      window.location.href = "/dashboard";
    });
    if (window.lucide) lucide.createIcons();
  }

  // Profile Icon
  const profilePlaceholder = document.getElementById("profile-icon-placeholder");
  if (profilePlaceholder) {
    profilePlaceholder.style.display = "flex";
    profilePlaceholder.addEventListener("click", () => {
      window.location.href = "/profile";
    });
    if (window.lucide) lucide.createIcons();
  }
}
