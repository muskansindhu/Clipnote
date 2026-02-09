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
       <i data-lucide="tag" class="tag-icon"></i>
      </div>
          <div class="note-list">
            ${data
          .map((item, index) => {
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
              }" data-index="${index}" data-seconds="${seconds}" data-timestamp="${item.video_timestamp}">
                    <div class="note-meta">
                      <div class="note-source-indicator ${item.note_source?.toLowerCase() === "ai" ? "ai" : "user"}" 
                           title="${item.note_source?.toLowerCase() === "ai" ? "AI Generated" : "User Note"}">
                        <i data-lucide="${item.note_source?.toLowerCase() === "ai" ? "bot" : "user"}" 
                           class="source-icon"></i>
                      </div>
                      <a href="${note.video_url}&t=${seconds}s" target="_blank" class="note-timestamp">
                        <strong class="timestamp">${item.video_timestamp}</strong>
                      </a>
                    </div>
                    <p class="note-copy">${item.note || "(No note)"}</p>
                    <div class="action-items">
                      <button type="button" class="action-btn action-item-icon edit-btn" aria-label="Edit note">
                        <i data-lucide="pencil"></i>
                      </button>
                      <button type="button" class="action-btn action-item-icon trash-btn" aria-label="Delete note">
                        <i data-lucide="trash-2"></i>
                      </button>
                    </div>
                  </div>
                `;
          })
          .join("")}
          </div>
        </div>
      `;

      const contentParent = document.getElementById("notes-content-container");
      if (contentParent) {
        contentParent.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
      if (window.lucide) lucide.createIcons();
      applyThemeToIconImages();
      getVideoLabel(videoId, token);

      const deleteModal = document.getElementById("delete-note-modal");
      const cancelDeleteBtn = document.getElementById("cancel-delete-note");
      const confirmDeleteBtn = document.getElementById("confirm-delete-note");
      let pendingDeleteTimestamp = null;

      const closeDeleteModal = () => {
        if (!deleteModal) return;
        deleteModal.style.display = "none";
        pendingDeleteTimestamp = null;
      };

      if (deleteModal) {
        if (cancelDeleteBtn) {
          cancelDeleteBtn.addEventListener("click", closeDeleteModal);
        }

        if (confirmDeleteBtn) {
          confirmDeleteBtn.addEventListener("click", () => {
            if (!pendingDeleteTimestamp) return;

            fetch(`/${videoId}`, {
              method: "DELETE",
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ timestamp: pendingDeleteTimestamp }),
            })
              .then((res) => {
                if (!res.ok) throw new Error("Failed to delete note.");
                location.reload();
              })
              .catch((err) => {
                console.error("Delete failed:", err);
              });
          });
        }

        deleteModal.addEventListener("click", (event) => {
          if (event.target === deleteModal) {
            closeDeleteModal();
          }
        });
      }

      const noteList = container.querySelector(".note-list");
      if (noteList) {
        noteList.addEventListener("click", (event) => {
          const button = event.target.closest("button");
          if (!button) return;

          const noteEntry = button.closest(".note-entry");
          if (!noteEntry) return;

          const index = Number(noteEntry.dataset.index);
          const item = data[index];
          if (!item) return;

          if (button.classList.contains("trash-btn")) {
            const timestamp = noteEntry.dataset.timestamp || item.video_timestamp;
            if (deleteModal) {
              pendingDeleteTimestamp = timestamp;
              deleteModal.style.display = "flex";
            } else {
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
            }
            return;
          }

          if (button.classList.contains("edit-btn")) {
            if (noteEntry.classList.contains("is-editing")) return;

            const noteCopy = noteEntry.querySelector(".note-copy");
            const actionContainer = noteEntry.querySelector(".action-items");
            if (!noteCopy || !actionContainer) return;

            noteEntry._originalNoteCopy = noteCopy;

            const textarea = document.createElement("textarea");
            textarea.value = item.note || "";
            textarea.className = "edit-textarea";
            noteCopy.replaceWith(textarea);
            textarea.focus();

            const trashBtn = actionContainer.querySelector(".trash-btn");
            const editBtn = actionContainer.querySelector(".edit-btn");

            if (!actionContainer.querySelector(".save-btn")) {
              const saveBtn = document.createElement("button");
              saveBtn.type = "button";
              saveBtn.className = "action-btn action-item-icon save-btn";
              saveBtn.innerHTML = `<i data-lucide="save"></i>`;
              actionContainer.insertBefore(saveBtn, trashBtn);
            }

            if (!actionContainer.querySelector(".cancel-btn")) {
              const cancelBtn = document.createElement("button");
              cancelBtn.type = "button";
              cancelBtn.className = "action-btn action-item-icon cancel-btn";
              cancelBtn.innerHTML = `<i data-lucide="x"></i>`;
              actionContainer.insertBefore(cancelBtn, trashBtn);
            }

            if (editBtn) editBtn.classList.add("is-hidden");
            noteEntry.classList.add("is-editing");
            if (window.lucide) lucide.createIcons();
            return;
          }

          if (button.classList.contains("cancel-btn")) {
            const actionContainer = noteEntry.querySelector(".action-items");
            const textarea = noteEntry.querySelector(".edit-textarea");
            const originalNoteCopy = noteEntry._originalNoteCopy;

            if (textarea && originalNoteCopy) {
              textarea.replaceWith(originalNoteCopy);
            }

            noteEntry.classList.remove("is-editing");

            const saveBtn = actionContainer?.querySelector(".save-btn");
            const cancelBtn = actionContainer?.querySelector(".cancel-btn");
            if (saveBtn) saveBtn.remove();
            if (cancelBtn) cancelBtn.remove();

            const editBtn = actionContainer?.querySelector(".edit-btn");
            if (editBtn) {
              editBtn.classList.remove("is-hidden");
              if (!editBtn.querySelector("svg") && !editBtn.querySelector("i[data-lucide]")) {
                editBtn.innerHTML = `<i data-lucide="pencil"></i>`;
              }
            }
            if (window.lucide) lucide.createIcons();
            return;
          }

          if (button.classList.contains("save-btn")) {
            const textarea = noteEntry.querySelector(".edit-textarea");
            if (!textarea) return;
            const updatedNote = textarea.value.trim();
            if (updatedNote === "") return;

            const timestamp = item.video_timestamp;

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
          }
        });
      }
    })
    .catch((err) => {
      console.error("Error fetching video note:", err);
    });
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

    if (window.lucide) lucide.createIcons();
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
