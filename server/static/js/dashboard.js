document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();
  checkGuestStatus();

  const token = localStorage.getItem("clipnote_token");
  if (!token) {
    window.location.href = "/login";
  }

  let currentPage = 1;

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

  function loadAllVideos(page) {
    fetch(`/all-video?page=${page}`, {
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

  loadAllVideos(currentPage);

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
      container.innerHTML = "";

      // 1. Toolbar (Top)
      const toolbar = document.createElement("div");
      toolbar.className = "labels-toolbar";


      const filterBtn = document.createElement("button");
      filterBtn.className = "filter-icon-btn";
      filterBtn.title = "Filter Options";
      filterBtn.innerHTML = `<i data-lucide="filter" style="width:18px; height:18px;" stroke-width="2"></i>`;
      toolbar.appendChild(filterBtn);


      const plusBtn = document.createElement("button");
      plusBtn.className = "add-label-btn";
      plusBtn.innerHTML = `<i data-lucide="plus" style="width:18px; height:18px;" stroke-width="2"></i>`;
      plusBtn.title = "Add Label";
      plusBtn.addEventListener("click", () => {
        document.getElementById("label-modal").style.display = "flex";
      });
      toolbar.appendChild(plusBtn);

      container.appendChild(toolbar);


      const scrollArea = document.createElement("div");
      scrollArea.className = "labels-scroll-area";


      const labelsData = [];
      let activeLabel = null;

      data.forEach((label) => {
        if (!labelsData.includes(label)) {
          const labelBtn = document.createElement("button");
          labelBtn.className = "label";
          labelBtn.innerHTML = `${label.label_name}`;

          labelBtn.addEventListener("click", function () {
            const notesContainer = document.getElementById("notes-container");
            const paginationControls = document.getElementById("pagination-controls");

            if (activeLabel === label.label_name) {
              this.classList.remove("active");
              activeLabel = null;
              currentPage = 1;
              loadAllVideos(currentPage);
            } else {
              document.querySelectorAll(".label").forEach((btn) => {
                btn.classList.remove("active");
              });

              this.classList.add("active");
              activeLabel = label.label_name;
              paginationControls.style.display = "none";

              fetch(`/${label.label_name}/note`, {
                headers: { Authorization: "Bearer " + token },
              })
                .then((response) => {
                  if (!response.ok) throw new Error("Failed to fetch label-specific notes.");
                  return response.json();
                })
                .then((videos) => {

                  notesContainer.innerHTML = "";
                  if (videos.length === 0) {
                    notesContainer.innerHTML = `<p class="no-videos-message" style="text-align:center; padding:20px; color:${localStorage.getItem("theme") === "light" ? "#444" : "#aaa"}; font-style:italic;">No videos found for this label.</p>`;
                    return;
                  }
                  videos.forEach((video) => {
                    const card = document.createElement("div");
                    card.className = "card";
                    card.id = video.video_id;
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
                            </div>`;
                    notesContainer.appendChild(card);
                  });
                })
                .catch((err) => console.error(err));
            }
          });

          scrollArea.appendChild(labelBtn);
          labelsData.push(label.label_name);
        }
      });


      container.appendChild(scrollArea);

      if (window.lucide) lucide.createIcons();


      const modal = document.getElementById("label-modal");
      const closeBtn = document.getElementById("close-label-modal");
      if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";

      // Close on outside click for label modal
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });

      const form = document.getElementById("label-form");


      form.onsubmit = function (e) {
        e.preventDefault();
        const labelName = document.getElementById("new-label-input").value.trim();
        if (!labelName) return;

        fetch("/label", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ label_name: labelName }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to add label.");
            return res.json();
          })
          .then(() => {
            modal.style.display = "none";
            location.reload();
          })
          .catch((err) => {
            console.error(err);
            alert("Failed to add label.");
          });
      };
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

  const searchTerm = searchInput.value.toLowerCase();
  const cards = document.getElementsByClassName("card");

  Array.from(cards).forEach((card) => {
    const titleEl = card.querySelector("h3");
    if (titleEl) {
      const title = titleEl.textContent.toLowerCase();
      const matches = title.includes(searchTerm);
      card.style.display = matches ? "flex" : "none";
    }
  });
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
