document.addEventListener("DOMContentLoaded", async function () {
  const tabDetails = await getTabDetails();
  const videoTitle = await execute(getVideoTitle, tabDetails.id);
  const currentTimestamp = await execute(getTimestamp, tabDetails.id);

  populateFormDetails(tabDetails.videoURL, videoTitle, currentTimestamp);

  const videoDetails = {
    videoTitle: videoTitle,
    videoURL: tabDetails.videoURL,
    currentTimestamp: currentTimestamp,
  };

  if (videoDetails) {
    console.log(videoDetails);
  } else {
    console.log("Please play a YouTube video to take notes.");
  }
});

function getTabDetails() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      const id = tabs[0]?.id;

      if (url && url.includes("https://www.youtube.com/watch")) {
        const tabDetails = { videoURL: url, id: id };
        resolve(tabDetails);
      } else {
        resolve(null);
      }
    });
  });
}

function getTimestamp() {
  const timestamp = document.querySelector(".ytp-time-current");
  if (timestamp) {
    return timestamp.innerText;
  } else {
    console.log("Timestamp not found");
  }
}

function getVideoTitle() {
  const title = document.querySelector("#title > h1 > yt-formatted-string");
  if (title) {
    return title.innerText;
  } else {
    console.log("Title not found");
  }
}

async function execute(func, id) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: id },
        func: func,
      },
      (result) => {
        resolve(result[0]?.result);
      }
    );
  });
}

function populateFormDetails(videoURL, videoTitle, currentTimestamp) {
  const urlField = document.getElementById("video-url");
  const titleField = document.getElementById("video-title");
  const timestampField = document.getElementById("timestamp");

  urlField.value = videoURL;
  titleField.value = videoTitle;
  timestampField.value = currentTimestamp;
}

document.getElementById("submit").addEventListener("click", function () {
  var videoTitle = document.getElementById("video-title").value;
  var currentTimeStamp = document.getElementById("timestamp").value;
  var videoUrl = document.getElementById("video-url").value;

  var data = {
    videoUrl: videoUrl,
    videoTitle: videoTitle,
    currentTimeStamp: currentTimeStamp,
    notes: document.getElementById("notes").value,
  };

  fetch("http://127.0.0.1:5001/add-notes", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Success:", data);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});

document.getElementById("summarize").addEventListener("click", function () {
  const videoUrl = document.getElementById("video-url").value;
  console.log(videoUrl);

  const data = {
    video_url: videoUrl,
  };

  fetch("http://127.0.0.1:5001/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Success:", data);
      const summary = data.message;
      const summaryList = document.getElementById("summary-list");
      const summarySection = document.getElementById("summary-section");

      summaryList.innerHTML = "";

      summary.split("\n").forEach((line) => {
        if (line.trim()) {
          const li = document.createElement("li");
          li.textContent = line.trim();
          summaryList.appendChild(li);
        }
      });

      summarySection.style.display = "block";
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});
