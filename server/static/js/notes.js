document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();

  const videoId = window.location.href.split("/").pop();
  const token = localStorage.getItem("clipnote_token");
  const clipchatBtn = document.getElementById("clipchat-btn");

  if (!token) {
    window.location.href = "/login";
    return;
  }

  if (clipchatBtn) {
    clipchatBtn.href = `/clipchat/${videoId}`;
  }

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
               alt="${escapeHtml(note.video_title)}"
               class="video-thumbnail"
               onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'" />
        </div>
        <h2><a href="${escapeHtml(note.video_url)}" target="_blank" rel="noopener" class="video-title">${escapeHtml(note.video_title)}</a></h2>
      <div class="video-tag">
        <div class="video-tag-label-area"></div>
        <button type="button" class="btn btn-secondary btn-small video-tag-export-btn" id="export-note-btn">Export .md</button>
        <a href="/clipchat/${videoId}" class="btn btn-secondary btn-small video-tag-clipchat-btn">Open Clipchat</a>
      </div>
          ${note.video_summary ? `
          <details class="video-summary-details">
            <summary class="video-summary-title">Summary</summary>
            <div class="video-summary-content">
              <p>${escapeHtml(note.video_summary).replace(/\n/g, "<br>")}</p>
            </div>
          </details>
          ` : ""}
          <div class="note-list">
            ${data.map((item, index) => renderNoteEntry(item, index, note.video_url)).join("")}
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
      setupExport(videoId, token);
      pollPendingNotes(videoId, token, data, container);

      const deleteModal = document.getElementById("delete-note-modal");
      const cancelDeleteBtn = document.getElementById("cancel-delete-note");
      const confirmDeleteBtn = document.getElementById("confirm-delete-note");
      let pendingDeleteId = null;

      const closeDeleteModal = () => {
        if (!deleteModal) return;
        deleteModal.style.display = "none";
        pendingDeleteId = null;
      };

      if (deleteModal) {
        if (cancelDeleteBtn) {
          cancelDeleteBtn.addEventListener("click", closeDeleteModal);
        }

        if (confirmDeleteBtn) {
          confirmDeleteBtn.addEventListener("click", () => {
            if (pendingDeleteId === null) return;

            fetch(`/${videoId}`, {
              method: "DELETE",
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ note_id: pendingDeleteId }),
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
            if (deleteModal) {
              pendingDeleteId = item.id;
              deleteModal.style.display = "flex";
            } else {
              fetch(`/${videoId}`, {
                method: "DELETE",
                headers: {
                  Authorization: "Bearer " + token,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ note_id: item.id }),
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

            fetch(`/${videoId}`, {
              method: "PATCH",
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                note_id: item.id,
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

  // Clipchat Icon
  const clipchatNavBtn = document.getElementById("clipchat-nav-btn");
  if (clipchatNavBtn) {
    clipchatNavBtn.style.display = "flex";
    clipchatNavBtn.addEventListener("click", () => {
      window.location.href = "/clipchat";
    });
  }

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
      const tagDiv = document.querySelector(".video-tag-label-area");
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



const NOTE_TYPE_BADGES = {
  idea: { icon: "💡", label: "Idea" },
  question: { icon: "❓", label: "Question" },
  key_point: { icon: "⭐", label: "Key point" },
  todo: { icon: "✅", label: "To do" },
};
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function noteCopyHtml(item) {
  if (item.note) return escapeHtml(item.note);
  if (item.status === "pending") return "Writing your note…";
  if (item.status === "failed") return "AI note unavailable. Edit to write your own.";
  return "(No note)";
}

function renderNoteEntry(item, index, videoUrl) {
  const isAi = item.note_source?.toLowerCase() === "ai";
  const seconds = item.timestamp_seconds;
  const badge = NOTE_TYPE_BADGES[item.note_type];
  const stateClass = item.status === "pending" ? " is-pending" : item.status === "failed" && !item.note ? " is-failed" : "";
  const time =
    seconds === null || seconds === undefined
      ? `<span class="note-timestamp no-time" title="Saved to the whole video"><strong class="timestamp">Video</strong></span>`
      : `<a href="${escapeHtml(videoUrl)}&t=${seconds}s" target="_blank" rel="noopener" class="note-timestamp"><strong class="timestamp">${escapeHtml(item.video_timestamp)}</strong></a>`;

  return `
    <div class="note-entry ${isAi ? "ai-note" : "user-note"}${stateClass}" data-index="${index}" data-note-id="${item.id}">
      <div class="note-meta">
        <div class="note-source-indicator ${isAi ? "ai" : "user"}" title="${isAi ? "AI Generated" : "User Note"}">
          <i data-lucide="${isAi ? "bot" : "user"}" class="source-icon"></i>
        </div>
        ${time}
        ${badge ? `<span class="note-type-badge" title="${badge.label}">${badge.icon} ${badge.label}</span>` : ""}
      </div>
      <p class="note-copy">${noteCopyHtml(item)}</p>
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
}

function setupExport(videoId, token) {
  const button = document.getElementById("export-note-btn");
  if (!button) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const response = await fetch(`/api/export/${videoId}`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error("Export failed.");
      const disposition = response.headers.get("Content-Disposition") || "";
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || "clipnote.md";
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      button.disabled = false;
    }
  });
}

// Notes saved from the share sheet are completed in the background; refresh them in place.
function pollPendingNotes(videoId, token, data, container) {
  let attempts = 0;

  const tick = async () => {
    if (!data.some((item) => item.status === "pending") || attempts >= POLL_MAX_ATTEMPTS) return;
    attempts += 1;
    try {
      const response = await fetch(`/note/${videoId}`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (response.ok) {
        const fresh = await response.json();
        fresh.forEach((item) => {
          const index = data.findIndex((existing) => existing.id === item.id);
          const entry = container.querySelector(`.note-entry[data-note-id="${item.id}"]`);
          if (index === -1 || !entry || data[index].status !== "pending" || item.status === "pending") return;
          data[index] = item;
          entry.classList.remove("is-pending");
          entry.classList.toggle("is-failed", item.status === "failed" && !item.note);
          entry.classList.toggle("ai-note", item.note_source?.toLowerCase() === "ai");
          const copy = entry.querySelector(".note-copy");
          if (copy) copy.innerHTML = noteCopyHtml(item);
        });
      }
    } catch (error) {
      console.error("Polling notes failed:", error);
    }
    setTimeout(tick, POLL_INTERVAL_MS);
  };

  setTimeout(tick, POLL_INTERVAL_MS);
}
