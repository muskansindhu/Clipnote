document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();

  const videoId = window.location.href.split("/").pop();

  fetch(`/note/${videoId}`)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch notes.");
      return response.json();
    })
    .then((data) => {
      if (data.length === 0) return;

      const note = data[0];

      const container = document.createElement("div");
      container.className = "notes-card";

      container.innerHTML = `
          <div class="note-content">
            <h2>${note.video_title}</h2>
            <div class="note-list">
              ${data
                .map((item) => {
                  const parts = item.video_timestamp.split(":").map(Number);
                  const seconds =
                    parts.length === 3
                      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                      : parts.length === 2
                      ? parts[0] * 60 + parts[1]
                      : parts[0];

                  return `
                <div class="note-entry">
                  <a href="${note.video_url}&t=${seconds}s" target="_blank">
                    <strong>${item.video_timestamp}</strong>
                  </a> - ${item.note || "(No note)"}
                </div>
              `;
                })
                .join("")}
            </div>
          </div>
        `;

      document.body.appendChild(container);
    })
    .catch((err) => {
      console.error("Error fetching video note:", err);
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
