let cachedVideoTitle = "";

document.addEventListener("DOMContentLoaded", async function () {
  const hasToken = await checkAuthToken();

  if (!hasToken) {
    window.location.href = chrome.runtime.getURL("login.html");
    return;
  }

  const tabDetails = await getTabDetails();
  if (!tabDetails) {
    document.getElementById("error-message").style.display = "block";
    document.getElementById("content-wrapper").style.display = "none";
    return;
  }

  const videoTitle = await execute(getVideoTitle, tabDetails.id);
  const currentTimestamp = await execute(getTimestamp, tabDetails.id);

  cachedVideoTitle = videoTitle || "";
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
  const timestampLabel = document.getElementById("timestamp-display");

  urlField.value = videoURL;
  cachedVideoTitle = videoTitle || cachedVideoTitle;
  if (timestampLabel) {
    timestampLabel.textContent = currentTimestamp || "--:--";
  }
}

document.getElementById("submit").addEventListener("click", function () {
  showLoader("Saving note...");

  chrome.storage.local.get("clipnote_token", function (result) {
    const token = result.clipnote_token;

    if (!token) {
      console.error("No token found in storage");
      hideLoader();
      return;
    }

    const currentTimeStamp =
      document.getElementById("timestamp-display")?.textContent || "";
    const videoUrl = document.getElementById("video-url").value;
    const notes = document.getElementById("notes").value;

    const data = {
      videoUrl,
      videoTitle: cachedVideoTitle,
      currentTimeStamp,
      notes,
    };

    fetch(`${CONFIG.BASE_URL}/add-notes`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
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
      })
      .finally(() => {
        hideLoader();
      });
  });
});

function showLoader(message = "") {
  const loader = document.getElementById("loader-wrapper");
  if (loader) {
    loader.classList.add("is-visible");
  }
  const messageEl = document.getElementById("loader-message");
  if (messageEl) {
    messageEl.textContent = message;
  }
}

function hideLoader() {
  const loader = document.getElementById("loader-wrapper");
  if (loader) {
    loader.classList.remove("is-visible");
  }
  const messageEl = document.getElementById("loader-message");
  if (messageEl) {
    messageEl.textContent = "";
  }
}

async function checkAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("clipnote_token", (result) => {
      const token = result.clipnote_token;
      resolve(typeof token === "string" && token.trim().length > 0);
    });
  });
}
