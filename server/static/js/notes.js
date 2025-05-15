document.addEventListener("DOMContentLoaded", function () {
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
                .map(
                  (item) => `
                <div class="note-entry">
                  <strong>${item.video_timestamp}</strong> - ${
                    item.note || "(No note)"
                  }
                </div>
              `
                )
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
