document.addEventListener("DOMContentLoaded", function () {
  fetch("/all-notes")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch notes.");
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById("notes-container");
      const noteTitle = [];

      data.forEach((note) => {
        if (!noteTitle.includes(note.video_title)) {
          const isFavourited = note.fav === true;

          const card = document.createElement("div");
          card.className = "card";

          const iconSrc = isFavourited
            ? "static/assets/fav_filled.png"
            : "static/assets/fav_unfilled.png";

          card.innerHTML = `
            <div class="card-header">
              <h3 id="video-title">${note.video_title}</h3>
              <img src="${iconSrc}" alt="fav" class="fav-icon"/>
            </div>
          `;

          container.appendChild(card);
          noteTitle.push(note.video_title);
        }
      });
    })
    .catch((error) => {
      console.error("Error loading notes:", error);
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
