document.addEventListener("DOMContentLoaded", function () {
  fetch("/all-notes")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch notes.");
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById("notes-container");
      data.forEach((note) => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h3>${note.video_title}</h3>
          `;
        container.appendChild(card);
      });
    })
    .catch((error) => {
      console.error("Error loading notes:", error);
    });
});
