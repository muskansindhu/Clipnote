document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();

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

    // Controls display is managed by CSS now, or triggered by loadAllVideos
    // We just need to make sure it's visible if it was hidden by label filter
    controls.style.display = "flex";

    pageIndicator.innerText = `Page ${currentPage}`;

    prevBtn.disabled = currentPage === 1;
    // Removed inline opacity, handled by CSS :disabled

    nextBtn.disabled = !hasNext;
    // Removed inline opacity, handled by CSS :disabled
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
        container.innerHTML = ""; // Clear existing notes

        // Handle new response format { videos: [], has_next: bool }
        const videos = data.videos || [];
        const hasNext = data.has_next || false;

        videos.forEach((video) => {
          const isFavourited = video.fav === true;

          const card = document.createElement("div");
          card.className = "card";
          card.id = video.id;

          const iconSrc = isFavourited
            ? "static/assets/fav_filled.png"
            : "static/assets/fav_unfilled.png";

          const videoId = video.video_url.split('v=')[1]?.split('&')[0] || '';
          card.innerHTML = `
            <div class="card-content-wrapper">
              <div class="card-thumbnail">
                <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${video.video_title}" />
              </div>
              <div class="card-header">
                <h3 id="video-title">${video.video_title}</h3>
                <img src="${iconSrc}" alt="fav" class="fav-icon"/>
              </div>
            </div>
          `;

          container.appendChild(card);
        });

        currentPage = page;
        updatePaginationControls(hasNext);
      })
      .catch((error) => {
        console.error("Error loading notes:", error);
      });
  }

  // Initial Load
  loadAllVideos(currentPage);

  // Pagination Event Listeners
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
      const labels = [];

      let activeLabel = null;
      data.forEach((label) => {
        if (!labels.includes(label)) {
          const labelBtn = document.createElement("button");
          labelBtn.className = "label";
          labelBtn.innerHTML = `${label.label_name}`;

          labelBtn.addEventListener("click", function () {
            const notesContainer = document.getElementById("notes-container");
            const paginationControls = document.getElementById("pagination-controls");

            if (activeLabel === label.label_name) {
              this.classList.remove("active");
              activeLabel = null;

              // Return to all videos view (reset pagination)
              currentPage = 1;
              loadAllVideos(currentPage);
            } else {
              document.querySelectorAll(".label").forEach((btn) => {
                btn.classList.remove("active");
              });

              this.classList.add("active");
              activeLabel = label.label_name;

              // Hide pagination controls when filtering by label
              paginationControls.style.display = "none";

              fetch(`/${label.label_name}/note`, {
                headers: { Authorization: "Bearer " + token },
              })
                .then((response) => {
                  if (!response.ok)
                    throw new Error("Failed to fetch label-specific notes.");
                  return response.json();
                })
                .then((videos) => {
                  notesContainer.innerHTML = "";

                  if (videos.length === 0) {
                    const noDataMessage = document.createElement("p");
                    noDataMessage.textContent =
                      "No videos found for this label.";
                    noDataMessage.className = "no-videos-message";

                    const theme = localStorage.getItem("theme");
                    noDataMessage.style.color =
                      theme === "light" ? "#444" : "#aaa";

                    noDataMessage.style.fontStyle = "italic";
                    noDataMessage.style.padding = "10px";
                    noDataMessage.style.textAlign = "center";

                    notesContainer.appendChild(noDataMessage);
                    return;
                  }

                  videos.forEach((video) => {
                    const isFavourited = video.fav === true;

                    const card = document.createElement("div");
                    card.className = "card";
                    card.id = video.video_id;

                    const iconSrc = isFavourited
                      ? "static/assets/fav_filled.png"
                      : "static/assets/fav_unfilled.png";

                    const videoId = video.video_url.split('v=')[1]?.split('&')[0] || '';
                    card.innerHTML = `
            <div class="card-content-wrapper">
              <div class="card-thumbnail">
                <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${video.video_title}" />
              </div>
              <div class="card-header">
                <h3 id="video-title">${video.video_title}</h3>
                <img src="${iconSrc}" alt="fav" class="fav-icon"/>
              </div>
            </div>
          `;

                    notesContainer.appendChild(card);
                  });
                })
                .catch((err) =>
                  console.error("Error fetching videos by label:", err)
                );
            }
          });

          container.appendChild(labelBtn);
          labels.push(label.label_name);
        }
      });

      const plusIcon = document.createElement("img");
      plusIcon.src =
        localStorage.getItem("theme") === "light"
          ? "/static/assets/plus-light.png"
          : "/static/assets/plus.png";

      plusIcon.alt = "Add Label";
      plusIcon.style.width = "20px";
      plusIcon.style.height = "20px";
      plusIcon.style.cursor = "pointer";
      plusIcon.style.cursor = "pointer";

      plusIcon.setAttribute("data-dark", "/static/assets/plus.png");
      plusIcon.setAttribute("data-light", "/static/assets/plus-light.png");
      plusIcon.setAttribute("data-theme-switchable", "true");

      plusIcon.addEventListener("click", () => {
        document.getElementById("label-modal").style.display = "block";
      });

      document
        .getElementById("close-label-modal")
        .addEventListener("click", () => {
          document.getElementById("label-modal").style.display = "none";
        });

      document
        .getElementById("label-form")
        .addEventListener("submit", function (e) {
          e.preventDefault();
          const labelName = document
            .getElementById("new-label-input")
            .value.trim();
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
              document.getElementById("label-modal").style.display = "none";
              location.reload();
            })
            .catch((err) => {
              console.error("Error adding label:", err);
              alert("Failed to add label.");
            });
        });

      container.appendChild(plusIcon);
    });
});

document.addEventListener("click", function (event) {
  if (event.target.classList.contains("fav-icon")) {
    const token = localStorage.getItem("clipnote_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const videoTitle = event.target
      .closest(".card")
      .querySelector("h3").textContent;

    const isFavourited = event.target
      .getAttribute("src")
      .includes("fav_filled");

    const endpoint = isFavourited ? "/unfav-note" : "/fav-note";
    const newIcon = isFavourited
      ? "static/assets/fav_unfilled.png"
      : "static/assets/fav_filled.png";

    fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ video_title: videoTitle }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        event.target.setAttribute("src", newIcon);
      })
      .catch((err) => console.error(err));
  }
});

document.addEventListener("click", function (event) {
  if (event.target.classList.contains("fav-icon")) return;
  const card = event.target.closest(".card");
  if (card) {
    const videoId = card.id;
    if (videoId) {
      window.location.href = `/${videoId}`;
    }
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
      card.style.display = matches ? "block" : "none";
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
