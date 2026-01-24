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

  // Profile Icon & Dropdown
  const profilePlaceholder = document.getElementById("profile-icon-placeholder");
  const dropdown = document.getElementById("profile-dropdown");
  const manageBtn = document.getElementById("manage-profile-btn");
  const logoutTrigger = document.getElementById("logout-trigger-btn");

  // Modal Elements
  const logoutModal = document.getElementById("logout-modal");
  const cancelLogout = document.getElementById("cancel-logout");
  const confirmLogout = document.getElementById("confirm-logout");

  if (profilePlaceholder) {
    profilePlaceholder.style.display = "flex";

    // Toggle Dropdown
    profilePlaceholder.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!profilePlaceholder.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove("show");
      }
    });

    // Dropdown Actions
    if (manageBtn) {
      manageBtn.addEventListener("click", () => {
        window.location.href = "/profile";
      });
    }

    if (logoutTrigger) {
      logoutTrigger.addEventListener("click", () => {
        dropdown.classList.remove("show");
        logoutModal.style.display = "flex";
      });
    }

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  // Modal Logic
  if (logoutModal) {
    if (cancelLogout) {
      cancelLogout.addEventListener("click", () => {
        logoutModal.style.display = "none";
      });
    }

    if (confirmLogout) {
      confirmLogout.addEventListener("click", () => {
        localStorage.removeItem("clipnote_token");
        window.location.href = "/";
      });
    }

    // Close modal on outside click
    logoutModal.addEventListener("click", (e) => {
      if (e.target === logoutModal) {
        logoutModal.style.display = "none";
      }
    });
  }

  checkGuestStatus();
}

function checkGuestStatus() {
  const token = localStorage.getItem("clipnote_token");
  if (!token) return;

  fetch("/user-status", {
    headers: { Authorization: "Bearer " + token },
  })
    .then(res => res.json())
    .then(data => {
      if (data.is_guest) {
        const badge = document.getElementById("dropdown-guest-info");
        if (badge) {
          const days = data.days_remaining;
          const hours = data.hours_remaining;
          let timeText = "";
          if (days > 0) {
            timeText = `${days}d ${hours}h left`;
          } else {
            timeText = `${hours}h left`;
          }

          badge.innerHTML = `<span style="display:block; font-size:0.75rem; opacity:0.8;">Trial Expires In:</span> ${timeText}`;
          badge.style.display = "block";
        }
      }
    })
    .catch(err => console.error("Error checking status:", err));
}
