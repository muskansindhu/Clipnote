const DEFAULT_CLIPCHAT_QUESTIONS = [
  "Explain the main idea",
  "List key takeaways",
  "Show key moments",
];

document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();
  if (window.lucide) lucide.createIcons();

  const token = localStorage.getItem("clipnote_token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  const videoId = window.location.pathname.split("/").filter(Boolean).pop();
  if (!videoId) return;

  const backToNoteBtn = document.getElementById("back-to-note-btn");
  const form = document.getElementById("clipchat-form");
  const input = document.getElementById("clipchat-input");
  const submitButton = document.getElementById("clipchat-submit");
  const thread = document.getElementById("clipchat-thread");
  const emptyState = document.getElementById("clipchat-empty-state");
  const defaultQuestionsContainer = document.getElementById(
    "clipchat-default-questions",
  );

  let videoContext = null;
  let conversationStarted = false;

  if (backToNoteBtn) {
    backToNoteBtn.href = `/${videoId}`;
  }

  renderDefaultQuestions(
    defaultQuestionsContainer,
    DEFAULT_CLIPCHAT_QUESTIONS,
    handleQuestionSubmit,
  );

  fetch(`/clipchat/${videoId}/context`, {
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load Clipchat context.");
      return response.json();
    })
    .then((data) => {
      videoContext = data;
      renderVideoContext(videoId, data);
      if (window.lucide) lucide.createIcons();
    })
    .catch((error) => {
      setEmptyStateCopy("I could not load this video's details right now.");
      console.error("Clipchat context error:", error);
    });

  if (form && input) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handleQuestionSubmit(input.value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleQuestionSubmit(input.value);
      }
    });
  }

  async function handleQuestionSubmit(rawQuestion) {
    const question = String(rawQuestion || "").trim();
    if (!question || !thread || !input || !submitButton) return;

    startConversation();
    appendUserMessage(question);
    input.value = "";
    setComposerLoading(true);

    const { answerElement, typingElement } = appendAssistantMessage();

    try {
      const response = await fetch(`/clipchat/${videoId}/stream`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        typingElement.remove();
        answerElement.style.display = "block";
        renderLinkedAnswer(
          answerElement,
          body.message || "Clipchat could not answer that just now.",
          "#",
        );
        return;
      }

      await streamAssistantAnswer(response.body, answerElement, typingElement);
    } catch (error) {
      typingElement.remove();
      answerElement.style.display = "block";
      renderLinkedAnswer(
        answerElement,
        "Clipchat hit a temporary issue while answering that question.",
        "#",
      );
      console.error("Clipchat stream error:", error);
    } finally {
      setComposerLoading(false);
    }
  }

  function startConversation() {
    if (conversationStarted) return;
    conversationStarted = true;
    if (emptyState) emptyState.style.display = "none";
    if (thread) thread.style.display = "flex";
  }

  function setComposerLoading(isLoading) {
    submitButton.disabled = isLoading;
    input.disabled = isLoading;
    submitButton.innerHTML = isLoading
      ? `<i data-lucide="loader-circle"></i>`
      : `<i data-lucide="send"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  function renderVideoContext(currentVideoId, data) {
    const titleElement = document.getElementById("clipchat-video-title");
    const videoLink = document.getElementById("clipchat-video-link");
    const summaryElement = document.getElementById("clipchat-summary");
    const thumbnail = document.getElementById("clipchat-thumbnail");

    if (titleElement)
      titleElement.textContent = data.video_title || "Untitled video";
    if (videoLink) videoLink.href = data.video_url || "#";
    if (summaryElement) {
      summaryElement.textContent =
        data.video_summary ||
        "No saved summary is available yet. Clipchat will answer from the transcript and your notes.";
    }
    if (thumbnail) {
      thumbnail.src = `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`;
      thumbnail.alt = data.video_title || "Video thumbnail";
      thumbnail.onerror = function () {
        this.src = `https://img.youtube.com/vi/${currentVideoId}/hqdefault.jpg`;
      };
    }
  }

  function appendUserMessage(text) {
    const message = document.createElement("article");
    message.className = "clipchat-message user";

    const bubble = document.createElement("div");
    bubble.className = "clipchat-bubble";
    renderTextWithLineBreaks(bubble, text);

    message.appendChild(bubble);
    thread.appendChild(message);
    thread.scrollTop = thread.scrollHeight;
  }

  function appendAssistantMessage() {
    const message = document.createElement("article");
    message.className = "clipchat-message assistant";

    const bubble = document.createElement("div");
    bubble.className = "clipchat-bubble";

    const answer = document.createElement("div");
    answer.className = "clipchat-message-answer";
    answer.textContent = "";
    answer.style.display = "none";

    const typing = document.createElement("div");
    typing.className = "clipchat-typing";
    typing.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    bubble.appendChild(typing);
    bubble.appendChild(answer);
    message.appendChild(bubble);
    thread.appendChild(message);
    thread.scrollTop = thread.scrollHeight;

    return {
      messageElement: message,
      answerElement: answer,
      typingElement: typing,
    };
  }

  async function streamAssistantAnswer(
    streamBody,
    answerElement,
    typingElement,
  ) {
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedText = "";
    let didStartRendering = false;

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventChunk of events) {
        const parsedEvent = parseSseEvent(eventChunk);
        if (!parsedEvent) continue;

        if (parsedEvent.event === "chunk") {
          const delta = parsedEvent.data.delta || "";
          if (delta && !didStartRendering) {
            didStartRendering = true;
            typingElement.remove();
            answerElement.style.display = "block";
          }
          streamedText = await animateIncomingText(
            answerElement,
            streamedText,
            delta,
            thread,
          );
        }

        if (parsedEvent.event === "done") {
          const finalAnswer = parsedEvent.data.answer || streamedText;
          const videoUrl = videoContext?.video_url || "#";
          if (!didStartRendering) {
            typingElement.remove();
            answerElement.style.display = "block";
          }
          renderLinkedAnswer(answerElement, finalAnswer, videoUrl);
          thread.scrollTop = thread.scrollHeight;
          return;
        }
      }

      if (done) {
        if (streamedText) {
          renderLinkedAnswer(
            answerElement,
            streamedText,
            videoContext?.video_url || "#",
          );
        } else {
          typingElement.remove();
          answerElement.style.display = "block";
        }
        return;
      }
    }
  }
});

function renderDefaultQuestions(container, questions, onClick) {
  if (!container) return;
  container.innerHTML = "";

  questions.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clipchat-question-chip";
    button.textContent = question;
    button.addEventListener("click", () => onClick(question));
    container.appendChild(button);
  });
}

function renderLinkedAnswer(element, text, videoUrl) {
  element.innerHTML = "";
  const answerText = String(text || "");
  const timestampPattern = /\[(\d+)\]/g;
  const matches = Array.from(answerText.matchAll(timestampPattern));

  if (matches.length === 0) {
    renderTextWithLineBreaks(element, answerText);
    return;
  }

  let cursor = 0;
  matches.forEach((match) => {
    const seconds = Number(match[1]);
    const matchIndex = match.index;
    if (matchIndex < cursor) return;

    appendTextSegment(element, answerText.slice(cursor, matchIndex));
    const displayTimestamp = secondsToTimestampDisplay(seconds);

    element.appendChild(document.createTextNode("["));

    const link = document.createElement("a");
    link.href = buildTimestampUrl(videoUrl, seconds);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "clipchat-inline-link";
    link.textContent = displayTimestamp;

    element.appendChild(link);
    element.appendChild(document.createTextNode("]"));
    cursor = matchIndex + match[0].length;
  });

  appendTextSegment(element, answerText.slice(cursor));
}

function appendTextSegment(element, text) {
  if (!text) return;
  renderTextWithLineBreaks(element, text);
}

function buildTimestampUrl(videoUrl, seconds) {
  if (!videoUrl || videoUrl === "#") return "#";
  const safeSeconds = Number.isFinite(Number(seconds))
    ? Math.max(0, Number(seconds))
    : 0;
  return `${videoUrl}${videoUrl.includes("?") ? "&" : "?"}t=${safeSeconds}s`;
}


function secondsToTimestampDisplay(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function renderTextWithLineBreaks(element, text) {
  const normalisedText = String(text || "").replace(/\s+(?=\d+\.\s)/g, "\n");
  const lines = normalisedText.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) {
      element.appendChild(document.createElement("br"));
    }
    appendInlineFormattedText(element, line);
  });
}

function appendInlineFormattedText(element, text) {
  const fragments = String(text || "").split(/(\*\*.*?\*\*)/g);

  fragments.forEach((fragment) => {
    if (!fragment) return;

    const boldMatch = fragment.match(/^\*\*(.*?)\*\*$/);
    if (boldMatch) {
      const strong = document.createElement("strong");
      strong.textContent = boldMatch[1];
      element.appendChild(strong);
      return;
    }

    element.appendChild(document.createTextNode(fragment));
  });
}

function parseSseEvent(eventChunk) {
  const lines = eventChunk.split("\n");
  let eventName = "message";
  const dataLines = [];

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      eventName = line.replace("event:", "").trim();
      return;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.replace("data:", "").trim());
    }
  });

  if (dataLines.length === 0) return null;

  try {
    return { event: eventName, data: JSON.parse(dataLines.join("\n")) };
  } catch (error) {
    console.error("Failed to parse SSE payload:", error);
    return null;
  }
}

async function animateIncomingText(
  answerElement,
  currentText,
  delta,
  scrollContainer,
) {
  let nextText = currentText;
  for (const character of delta) {
    nextText += character;
    answerElement.textContent = nextText;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await wait(12);
  }
  return nextText;
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function setEmptyStateCopy(text) {
  const copy = document.querySelector(".clipchat-empty-copy");
  if (copy) {
    copy.textContent = text;
  }
}

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

  const dashboardBtn = document.getElementById("dashboard-btn");
  if (dashboardBtn) {
    dashboardBtn.style.display = "flex";
    dashboardBtn.addEventListener("click", () => {
      window.location.href = "/dashboard";
    });
    if (window.lucide) lucide.createIcons();
  }

  const profilePlaceholder = document.getElementById(
    "profile-icon-placeholder",
  );
  const dropdown = document.getElementById("profile-dropdown");
  const manageBtn = document.getElementById("manage-profile-btn");
  const logoutTrigger = document.getElementById("logout-trigger-btn");
  const logoutModal = document.getElementById("logout-modal");
  const cancelLogout = document.getElementById("cancel-logout");
  const confirmLogout = document.getElementById("confirm-logout");

  if (profilePlaceholder) {
    profilePlaceholder.style.display = "flex";

    profilePlaceholder.addEventListener("click", (event) => {
      event.stopPropagation();
      dropdown.classList.toggle("show");
    });

    document.addEventListener("click", (event) => {
      if (
        !profilePlaceholder.contains(event.target) &&
        !dropdown.contains(event.target)
      ) {
        dropdown.classList.remove("show");
      }
    });

    if (manageBtn) {
      manageBtn.addEventListener("click", () => {
        window.location.href = "/profile";
      });
    }

    if (logoutTrigger && logoutModal) {
      logoutTrigger.addEventListener("click", () => {
        dropdown.classList.remove("show");
        logoutModal.style.display = "flex";
      });
    }
  }

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

    logoutModal.addEventListener("click", (event) => {
      if (event.target === logoutModal) {
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
    .then((response) => response.json())
    .then((data) => {
      if (!data.is_guest) return;

      const badge = document.getElementById("dropdown-guest-info");
      if (!badge) return;

      const days = data.days_remaining;
      const hours = data.hours_remaining;
      const timeText = days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;

      badge.innerHTML = `<span style="display:block; font-size:0.75rem; opacity:0.8;">Trial Expires In:</span> ${timeText}`;
      badge.style.display = "block";
    })
    .catch((error) => {
      console.error("Error checking status:", error);
    });
}
