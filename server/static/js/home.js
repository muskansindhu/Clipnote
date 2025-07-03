document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();
  fetch("/all-video")
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

  fetch("/labels")
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

            fetch(`/${label.label_name}/note`)
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
    });
});

document.addEventListener("click", function (event) {
  if (event.target.classList.contains("fav-icon")) {
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
