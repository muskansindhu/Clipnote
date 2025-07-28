document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();

  const token = localStorage.getItem("clipnote_token");
  if (!token) {
    window.location.href = "/login";
  }

  fetch("/all-video", {
    headers: { Authorization: "Bearer " + token },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch notes.");
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById("notes-container");
      const videoTitle = [];

      data.forEach((video) => {
        if (!videoTitle.includes(video.video_title)) {
          const isFavourited = video.fav === true;

          const card = document.createElement("div");
          card.className = "card";
          card.id = video.id;

          const iconSrc = isFavourited
            ? "static/assets/fav_filled.png"
            : "static/assets/fav_unfilled.png";

          card.innerHTML = `
            <div class="card-header">
              <h3 id="video-title">${video.video_title}</h3>
              <img src="${iconSrc}" alt="fav" class="fav-icon"/>
            </div>
          `;

          container.appendChild(card);
          videoTitle.push(video.video_title);
        }
      });
    })
    .catch((error) => {
      console.error("Error loading notes:", error);
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

      data.forEach((label) => {
        if (!labels.includes(label)) {
          const labelBtn = document.createElement("button");
          labelBtn.className = "label";
          labelBtn.innerHTML = `${label.label_name}`;

          labelBtn.addEventListener("click", function () {
            document.querySelectorAll(".label").forEach((btn) => {
              btn.classList.remove("active");
            });

            this.classList.add("active");

            fetch(`/${label.label_name}/note`, {
              headers: { Authorization: "Bearer " + token },
            })
              .then((response) => {
                if (!response.ok)
                  throw new Error("Failed to fetch label-specific notes.");
                return response.json();
              })
              .then((videos) => {
                const container = document.getElementById("notes-container");
                container.innerHTML = "";

                videos.forEach((video) => {
                  const isFavourited = video.fav === true;

                  const card = document.createElement("div");
                  card.className = "card";
                  card.id = video.video_id;

                  const iconSrc = isFavourited
                    ? "static/assets/fav_filled.png"
                    : "static/assets/fav_unfilled.png";

                  card.innerHTML = `
          <div class="card-header">
            <h3 id="video-title">${video.video_title}</h3>
            <img src="${iconSrc}" alt="fav" class="fav-icon"/>
          </div>
        `;

                  container.appendChild(card);
                });
              })
              .catch((err) =>
                console.error("Error fetching videos by label:", err)
              );
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
      plusIcon.style.marginLeft = "6px";
      plusIcon.style.position = "relative";
      plusIcon.style.verticalAlign = "middle";

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

document.getElementById("search").addEventListener("input", function () {
  const searchTerm = this.value.toLowerCase();
  const cards = document.getElementsByClassName("card");

  Array.from(cards).forEach((card) => {
    const title = card.querySelector("h3").textContent.toLowerCase();
    const matches = title.includes(searchTerm);
    card.style.display = matches ? "block" : "none";
  });
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
