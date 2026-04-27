document.addEventListener("DOMContentLoaded", function () {
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  const tempToken = getCookie("temp_access_token");
  if (tempToken) {
    localStorage.setItem("clipnote_token", tempToken);
    document.cookie = "temp_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }

  insertDashboardIconIfLoggedIn();
  setupThemeToggle();
  checkGuestStatus();

  const token = localStorage.getItem("clipnote_token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  if (isGuestAccessToken(token)) {
    window.location.href = "/clipchat";
    return;
  }

  let currentPage = 1;

  const filterState = {
    labels: new Set(),
    search: "",
    sort: "recent",
    start: "",
    end: ""
  };

  const filterModal = document.getElementById("filter-modal");
  const filterForm = document.getElementById("filter-form");
  const filterSort = document.getElementById("filter-sort");
  const filterStart = document.getElementById("filter-start");
  const filterEnd = document.getElementById("filter-end");
  const clearFiltersBtn = document.getElementById("clear-filters");
  const filterLabelsContainer = document.getElementById("filter-labels");

  function updatePaginationControls(hasNext) {
    const controls = document.getElementById("pagination-controls");
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    const pageIndicator = document.getElementById("page-indicator");

    controls.style.display = "flex";

    pageIndicator.innerText = `Page ${currentPage}`;

    prevBtn.disabled = currentPage === 1;

    nextBtn.disabled = !hasNext;

  }

  function buildQueryParams(page) {
    const params = new URLSearchParams();
    params.set("page", page);

    if (filterState.search) {
      params.set("search", filterState.search);
    }

    if (filterState.labels.size > 0) {
      params.set("labels", Array.from(filterState.labels).join(","));
    }

    if (filterState.sort && filterState.sort !== "recent") {
      params.set("sort", filterState.sort);
    }

    if (filterState.start) {
      params.set("start", filterState.start);
    }

    if (filterState.end) {
      params.set("end", filterState.end);
    }

    return params.toString();
  }

  function loadAllVideos(page) {
    const queryString = buildQueryParams(page);
    fetch(`/all-video?${queryString}`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch notes.");
        return response.json();
      })
      .then((data) => {
        const container = document.getElementById("notes-container");
        container.innerHTML = "";

        const videos = data.videos || [];
        const hasNext = data.has_next || false;

        videos.forEach((video) => {

          const card = document.createElement("div");
          card.className = "card";
          card.id = video.id;

          const videoId = video.video_url.split('v=')[1]?.split('&')[0] || '';
          card.innerHTML = `
            <div class="card-content-wrapper">
              <div class="card-thumbnail">
                <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${video.video_title}" />
              </div>
              <div class="card-main">
                <div class="card-header">
                  <h3 id="video-title">${video.video_title}</h3>
                </div>
              </div>
              <div class="card-actions">
                <button type="button" class="btn btn-primary btn-small view-note-btn">View Note</button>
              </div>
            </div>
          `;

          container.appendChild(card);
        });

        currentPage = page;

        // Helper to toggle empty state
        const emptyState = document.getElementById("empty-state");
        if (videos.length === 0) {
          if (emptyState) emptyState.style.display = "block";
          if (window.lucide) lucide.createIcons();
        } else {
          if (emptyState) emptyState.style.display = "none";
        }

        // Only show pagination if there are videos OR we are on a page > 1
        if (videos.length > 0 || currentPage > 1) {
          updatePaginationControls(hasNext);
        } else {
          const controls = document.getElementById("pagination-controls");
          if (controls) controls.style.display = "none";
        }
      })
      .catch((error) => {
        console.error("Error loading notes:", error);
      });
  }

  function renderFilterChips() {
    const container = document.getElementById("active-filters");
    if (!container) return;

    container.innerHTML = "";

    const createChip = (label, type, value) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      chip.dataset.type = type;
      if (value) chip.dataset.value = value;
      chip.innerHTML = `${label} <span aria-hidden="true">×</span>`;
      container.appendChild(chip);
    };

    if (filterState.search) {
      createChip(`Search: ${filterState.search}`, "search");
    }

    filterState.labels.forEach((label) => {
      createChip(label, "label", label);
    });

    if (filterState.sort && filterState.sort !== "recent") {
      const label = filterState.sort === "title" ? "Sort: Title" : "Sort";
      createChip(label, "sort");
    }

    if (filterState.start || filterState.end) {
      const start = filterState.start || "Any";
      const end = filterState.end || "Any";
      createChip(`Date: ${start} → ${end}`, "date");
    }
  }

  function applyFilters() {
    currentPage = 1;
    renderFilterChips();
    loadAllVideos(currentPage);
  }

  loadAllVideos(currentPage);

  if (filterForm) {
    filterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      filterState.sort = filterSort?.value || "recent";
      filterState.start = filterStart?.value || "";
      filterState.end = filterEnd?.value || "";
      if (filterModal) filterModal.style.display = "none";
      applyFilters();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      filterState.labels.clear();
      filterState.search = "";
      filterState.sort = "recent";
      filterState.start = "";
      filterState.end = "";

      const searchInputEl = document.getElementById("search");
      if (searchInputEl) searchInputEl.value = "";

      if (filterLabelsContainer) {
        filterLabelsContainer.querySelectorAll(".label").forEach((btn) => {
          btn.classList.remove("active");
        });
      }

      if (filterSort) filterSort.value = "recent";
      if (filterStart) filterStart.value = "";
      if (filterEnd) filterEnd.value = "";

      if (filterModal) filterModal.style.display = "none";
      applyFilters();
    });
  }

  document.getElementById("prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      loadAllVideos(currentPage - 1);
    }
  });

  document.getElementById("next-page").addEventListener("click", () => {
    loadAllVideos(currentPage + 1);
  });

  fetch("/labels", {
    headers: { Authorization: "Bearer " + token },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch notes.");
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById("labels");
      const searchActions = document.getElementById("search-actions");
      container.innerHTML = "";

      const filterBtn = document.createElement("button");
      filterBtn.className = "filter-icon-btn";
      filterBtn.title = "Filter Options";
      filterBtn.innerHTML = `<i data-lucide="filter" style="width:18px; height:18px;" stroke-width="2"></i>`;
      filterBtn.addEventListener("click", () => {
        if (!filterModal) return;
        if (filterSort) filterSort.value = filterState.sort || "recent";
        if (filterStart) filterStart.value = filterState.start || "";
        if (filterEnd) filterEnd.value = filterState.end || "";
        if (filterLabelsContainer) {
          filterLabelsContainer.querySelectorAll(".label").forEach((btn) => {
            const labelName = btn.dataset.label;
            if (labelName && filterState.labels.has(labelName)) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
          });
        }
        filterModal.style.display = "flex";
      });
      if (searchActions) {
        searchActions.innerHTML = "";
        searchActions.appendChild(filterBtn);
      }


      const activeFilters = document.createElement("div");
      activeFilters.className = "active-filters";
      activeFilters.id = "active-filters";


      const labelsData = new Set();

      data.forEach((label) => {
        if (!labelsData.has(label.label_name)) {
          const labelBtn = document.createElement("button");
          labelBtn.className = "label";
          labelBtn.dataset.label = label.label_name;
          labelBtn.textContent = label.label_name;

          labelBtn.addEventListener("click", function () {
            const labelName = this.dataset.label;
            if (!labelName) return;

            if (filterState.labels.has(labelName)) {
              filterState.labels.delete(labelName);
              this.classList.remove("active");
            } else {
              filterState.labels.add(labelName);
              this.classList.add("active");
            }
          });

          if (filterLabelsContainer) {
            filterLabelsContainer.appendChild(labelBtn);
          }
          labelsData.add(label.label_name);
        }
      });


      container.appendChild(activeFilters);

      if (window.lucide) lucide.createIcons();


      if (filterModal) {
        filterModal.addEventListener("click", (event) => {
          if (event.target === filterModal) {
            filterModal.style.display = "none";
          }
        });
      }

      if (activeFilters) {
        activeFilters.addEventListener("click", (event) => {
          const chip = event.target.closest(".filter-chip");
          if (!chip) return;

          const type = chip.dataset.type;
          const value = chip.dataset.value;

          if (type === "label" && value) {
            filterState.labels.delete(value);
            const labelBtn = filterLabelsContainer?.querySelector(`.label[data-label="${value}"]`);
            if (labelBtn) labelBtn.classList.remove("active");
          }

          if (type === "search") {
            filterState.search = "";
            const searchInputEl = document.getElementById("search");
            if (searchInputEl) searchInputEl.value = "";
          }

          if (type === "sort") {
            filterState.sort = "recent";
          }

          if (type === "date") {
            filterState.start = "";
            filterState.end = "";
          }

          applyFilters();
        });
      }

      renderFilterChips();
    });
});

document.addEventListener("click", function (event) {
  const viewBtn = event.target.closest(".view-note-btn");
  if (!viewBtn) return;
  const card = viewBtn.closest(".card");
  if (!card) return;
  const videoId = card.id;
  if (videoId) {
    window.location.href = `/${videoId}`;
  }
});

  // Search Functionality
  function performSearch() {
    const searchInput = document.getElementById("search");
    if (!searchInput) return;

    filterState.search = searchInput.value.trim();
    applyFilters();
  }

const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");

if (searchInput) {
  searchInput.addEventListener("input", performSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      performSearch();
    }
  });
}

if (searchBtn) {
  searchBtn.addEventListener("click", performSearch);
}

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
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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
}

function checkGuestStatus() {
  const badge = document.getElementById("dropdown-guest-info");
  if (badge) {
    badge.style.display = "none";
  }
}

function isGuestAccessToken(token) {
  const payload = parseAccessTokenPayload(token);
  return payload?.sub?.startsWith("guest_") || payload?.account_tier === "clipchat_trial";
}

function parseAccessTokenPayload(token) {
  if (!token) return null;

  try {
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return null;

    const normalised = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalised));
  } catch (error) {
    console.error("Failed to parse access token payload:", error);
    return null;
  }
}
