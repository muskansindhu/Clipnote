let cachedVideoTitle = "";

document.addEventListener("DOMContentLoaded", async function () {
  const hasToken = await checkAuthToken();

  if (!hasToken) {
    window.location.href = chrome.runtime.getURL("login.html");
    return;
  }

  const tabDetails = await getTabDetails();
  if (!tabDetails) {
    document.getElementById("error-message").hidden = false;
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
  const titleLabel = document.getElementById("video-title");
  if (titleLabel) {
    titleLabel.textContent = videoTitle || "";
  }
  const timestampLabel = document.getElementById("timestamp-display");

  urlField.value = videoURL;
  cachedVideoTitle = videoTitle || cachedVideoTitle;
  if (timestampLabel) {
    timestampLabel.textContent = currentTimestamp || "--:--";
  }
}

const submitButton = document.getElementById("submit");
const notesField = document.getElementById("notes");

document.getElementById("open-app").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: CONFIG.BASE_URL + "/library" });
});

notesField.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submitButton.click();
  }
});

submitButton.addEventListener("click", function () {
  const notes = notesField.value.trim();
  if (!notes) {
    showStatus("Write something first.", "error");
    return;
  }

  setSaving(true);

  chrome.storage.local.get("clipnote_token", function (result) {
    const token = result.clipnote_token;

    if (!token) {
      setSaving(false);
      showStatus("You are signed out. Open Clipnote to sign in.", "error");
      return;
    }

    const data = {
      videoUrl: document.getElementById("video-url").value,
      videoTitle: cachedVideoTitle,
      currentTimeStamp: document.getElementById("timestamp-display")?.textContent || "",
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
        notesField.value = "";
        showStatus("Saved. The AI summary will follow shortly.", "success");
      })
      .catch((error) => {
        console.error("Error:", error);
        showStatus("Could not save the note. Try again.", "error");
      })
      .finally(() => {
        setSaving(false);
      });
  });
});

function setSaving(saving) {
  submitButton.disabled = saving;
  submitButton.replaceChildren();
  if (saving) {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    submitButton.append(spinner, "Saving…");
  } else {
    submitButton.textContent = "Save note";
  }
}

function showStatus(message, tone) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status is-visible is-${tone}`;
}

async function checkAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("clipnote_token", (result) => {
      const token = result.clipnote_token;
      resolve(typeof token === "string" && token.trim().length > 0);
    });
  });
}
