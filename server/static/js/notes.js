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
        <div class="video-thumbnail-wrapper">
          <img src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" 
               alt="${note.video_title}" 
               class="video-thumbnail"
               onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'" />
        </div>
        <h2><a href="${note.video_url}" target="_blank" class="video-title">${note.video_title
        }</a></h2>
      <div class="video-tag">
       <img src="static/assets/tag.png" 
       class="action-item-icon tag-icon"
       data-light="static/assets/tag-light.png" 
       data-dark="static/assets/tag.png" 
       data-theme-switchable='true'
       />
      </div>
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
                  <div class="note-entry ${item.note_source?.toLowerCase() === "ai"
                ? "ai-note"
                : "user-note"
              }">
                    <div class="note-text">
                      <a href="${note.video_url}&t=${seconds}s" target="_blank">
                        <strong class="timestamp">${item.video_timestamp
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
      applyThemeToIconImages();
      getVideoLabel(videoId, token);

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

function applyThemeToIconImages() {
  const isLight = localStorage.getItem("theme") === "light";
  document
    .querySelectorAll("img[data-theme-switchable='true']")
    .forEach((img) => {
      img.src = isLight ? img.dataset.light : img.dataset.dark;
    });
}

function getVideoLabel(videoId, token) {
  fetch(`/${videoId}/label`, {
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch label.");
      return res.json();
    })
    .then((data) => {
      const tagDiv = document.querySelector(".video-tag");
      if (!tagDiv) return;

      if (data.label) {
        const labelWrapper = document.createElement("div");
        labelWrapper.className = "label-wrapper";

        const labelElement = document.createElement("span");
        labelElement.className = "label";
        labelElement.textContent = data.label;

        const removeBtn = document.createElement("span");
        removeBtn.className = "remove-label-btn";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = "Remove Tag";

        removeBtn.addEventListener("click", () => {
          fetch(`/video-label`, {
            method: "DELETE",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ video_id: videoId }),
          })
            .then((res) => {
              if (!res.ok) throw new Error("Failed to remove label");
              location.reload();
            })
            .catch((err) => console.error("Error removing label:", err));
        });

        labelWrapper.appendChild(labelElement);
        labelWrapper.appendChild(removeBtn);
        tagDiv.appendChild(labelWrapper);
        return;
      }
      const dropdown = document.createElement("select");
      dropdown.className = "label-dropdown";
      dropdown.innerHTML = `<option disabled selected>Select label</option>`;

      fetch("/labels", {
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((labelData) => {
          const seen = new Set();

          labelData.forEach((labelObj) => {
            const name = labelObj.label_name.trim();
            if (!seen.has(name)) {
              seen.add(name);
              const option = document.createElement("option");
              option.value = name;
              option.textContent =
                name.length > 10 ? name.slice(0, 10) + "..." : name;
              dropdown.appendChild(option);
            }
          });
        });

      dropdown.addEventListener("change", () => {
        const selectedLabel = dropdown.value;

        fetch(`/video-label`, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label_name: selectedLabel,
            video_id: videoId,
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to set label.");
            location.reload();
          })
          .catch((err) => console.error("Error adding label:", err));
      });

      tagDiv.appendChild(dropdown);
    })
    .catch((err) => {
      console.error("Error fetching video label:", err);
    });
}
