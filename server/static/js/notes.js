document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();

  const videoId = window.location.href.split("/").pop();
  const token = localStorage.getItem("clipnote_token");

  fetch(`/note/${videoId}`, {
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  })
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
          <a href="${note.video_url}" target="_blank"><h2>${
        note.video_title
      }</h2></a>
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
                    <div class="note-text">
                      <a href="${note.video_url}&t=${seconds}s" target="_blank">
                        <strong class="timestamp">${
                          item.video_timestamp
                        }</strong>
                      </a> - ${item.note || "(No note)"}
                    </div>
                    <div class="action-items">
                      <img src="static/assets/edit.png" class="action-item-icon edit-icon" />
                      <img src="static/assets/trash.png" class="action-item-icon trash-icon" />
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;

      document.body.appendChild(container);

      document.querySelectorAll(".trash-icon").forEach((icon, index) => {
        icon.addEventListener("click", () => {
          const timestamp = data[index].video_timestamp;

          fetch(`/${videoId}`, {
            method: "DELETE",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ timestamp }),
          })
            .then((res) => {
              if (!res.ok) throw new Error("Failed to delete note.");
              location.reload();
            })
            .catch((err) => {
              console.error("Delete failed:", err);
            });
        });
      });

      document.querySelectorAll(".edit-icon").forEach((icon, index) => {
        icon.addEventListener("click", () => {
          const noteCard = icon.closest(".note-entry");
          const noteText = noteCard.querySelector(".note-text");
          const actionContainer = icon.parentElement;

          const originalNote = data[index].note;
          const timestamp = data[index].video_timestamp;

          const textarea = document.createElement("textarea");
          textarea.value = originalNote;
          textarea.className = "edit-textarea";

          noteText.replaceWith(textarea);
          textarea.focus();

          const saveImg = document.createElement("img");
          saveImg.src = "/static/assets/save.png";
          saveImg.alt = "Save";
          saveImg.className = "action-item-icon";

          const cancelImg = document.createElement("img");
          cancelImg.src = "/static/assets/cancel.png";
          cancelImg.alt = "Cancel";
          cancelImg.className = "action-item-icon";

          const trashIcon = actionContainer.querySelector(".trash-icon");

          actionContainer.insertBefore(saveImg, trashIcon);
          actionContainer.insertBefore(cancelImg, trashIcon);

          icon.remove();

          cancelImg.addEventListener("click", () => {
            textarea.replaceWith(noteText);

            actionContainer.insertBefore(icon, saveImg);
            saveImg.remove();
            cancelImg.remove();
          });

          saveImg.addEventListener("click", () => {
            const updatedNote = textarea.value.trim();
            if (updatedNote === "") return;

            fetch(`/${videoId}`, {
              method: "PATCH",
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                timestamp,
                notes: updatedNote,
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error("Failed to update note.");
                location.reload();
              })
              .catch((err) => {
                console.error("Update failed:", err);
              });
          });
        });
      });
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
