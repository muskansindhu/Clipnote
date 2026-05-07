const DEFAULT_CLIPCHAT_QUESTIONS = [
  "Explain the main idea",
  "List key takeaways",
  "Show key moments",
];

document.addEventListener("DOMContentLoaded", function () {
  insertDashboardIconIfLoggedIn();
  setupThemeToggle();
  setupClipchatLimitModal();
  if (window.lucide) lucide.createIcons();

  let token = localStorage.getItem("clipnote_token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  const isGuest = isGuestAccessToken(token);
  let videoId = getClipchatVideoIdFromLocation();
  const backToNoteBtn = document.getElementById("back-to-note-btn");

  if (!isGuest) {
    const setupEyebrow = document.querySelector("#clipchat-setup-card .section-eyebrow");
    if (setupEyebrow) setupEyebrow.style.display = "none";
    const setupCopy = document.querySelector("#clipchat-setup-card .clipchat-setup-copy");
    if (setupCopy) setupCopy.textContent = "Paste a YouTube URL to chat with the video transcript.";
  }
  const form = document.getElementById("clipchat-form");
  const input = document.getElementById("clipchat-input");
  const submitButton = document.getElementById("clipchat-submit");
  const thread = document.getElementById("clipchat-thread");
  const emptyState = document.getElementById("clipchat-empty-state");
  const layout = document.getElementById("clipchat-layout");
  const setupCard = document.getElementById("clipchat-setup-card");
  const setupForm = document.getElementById("clipchat-video-form");
  const setupInput = document.getElementById("clipchat-video-url");
  const defaultQuestionsContainer = document.getElementById(
    "clipchat-default-questions",
  );
  const limitModal = document.getElementById("clipchat-limit-modal");
  const limitModalCopy = document.getElementById("clipchat-limit-copy");

  const pageSubtitleElem = document.getElementById("clipchat-page-subtitle");
  if (pageSubtitleElem) {
    pageSubtitleElem.textContent = isGuest
      ? "Ask about key ideas, moments, or exact timestamps from the transcript. Create an account to save notes and unlock the dashboard."
      : "Ask about key ideas, moments, or exact timestamps from the transcript.";
  }

  const emptyCopyElem = document.getElementById("clipchat-empty-copy");
  if (emptyCopyElem) {
    emptyCopyElem.textContent = isGuest
      ? "Ask about key ideas, moments, or exact timestamps from the transcript. Create an account to save notes and unlock the dashboard."
      : "Ask about key ideas, moments, or exact timestamps from the transcript.";
  }

  let videoContext = null;
  let conversationStarted = false;
  let hasShownLimitModal = false;

  renderDefaultQuestions(
    defaultQuestionsContainer,
    DEFAULT_CLIPCHAT_QUESTIONS,
    handleQuestionSubmit,
  );

  syncPageState();

  if (videoId) {
    initialiseThumbnail(videoId);
    loadClipchatContext(videoId);
  }

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

  if (setupForm && setupInput) {
    setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextVideoId = extractYouTubeVideoId(setupInput.value);
      if (!nextVideoId) {
        setEmptyStateCopy("Paste a valid YouTube watch URL to start Clipchat.");
        return;
      }

      videoId = nextVideoId;
      setupInput.value = "";
      window.history.replaceState({}, "", `/clipchat/${videoId}`);
      syncPageState();
      initialiseThumbnail(videoId);
      loadClipchatContext(videoId);
    });
  }

  async function handleQuestionSubmit(rawQuestion) {
    const question = String(rawQuestion || "").trim();
    if (!question || !thread || !input || !submitButton || !videoId) return;
    let nextTrialState = null;
    let nextTrialOptions = {};

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

      persistUpdatedToken(response.headers);

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        typingElement.remove();
        answerElement.style.display = "block";
        renderLinkedAnswer(
          answerElement,
          body.message || "Clipchat could not answer that just now.",
          "#",
        );
        nextTrialState = body.trial;
        nextTrialOptions = {
          lockComposer: response.status === 403,
          message: body.message,
        };
        return;
      }

      await streamAssistantAnswer(response.body, answerElement, typingElement);
      nextTrialState = readTrialStateFromHeaders(response.headers);
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
      applyTrialState(nextTrialState, nextTrialOptions);
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

  function syncPageState() {
    const hasVideo = Boolean(videoId);

    if (setupCard) {
      setupCard.style.display = hasVideo ? "none" : "grid";
    }

    if (layout) {
      layout.style.display = hasVideo ? "grid" : "none";
    }

    if (backToNoteBtn) {
      if (!hasVideo || isGuest) {
        backToNoteBtn.style.display = "none";
      } else {
        backToNoteBtn.style.display = "inline-flex";
        backToNoteBtn.href = `/${videoId}`;
      }
    }

    if (!hasVideo) {
      setEmptyStateCopy(
        "Paste a YouTube URL above to start chatting with a video.",
      );
      setComposerAvailability(
        false,
        "Paste a YouTube URL to start Clipchat...",
      );
    } else {
      setComposerAvailability(false, "Loading video details...");
    }
  }

  async function loadClipchatContext(currentVideoId) {
    try {
      const response = await fetch(`/clipchat/${currentVideoId}/context`, {
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load Clipchat context.");
      }

      const data = await response.json();
      videoContext = data;
      renderVideoContext(currentVideoId, data);
      applyTrialState(data.trial);
      if (needsAssetPreparation(data.asset_status)) {
        setPreparationState(true);
        await prepareClipchatAssets(currentVideoId);
      } else {
        setPreparationState(false);
      }
      if (window.lucide) lucide.createIcons();
    } catch (error) {
      setEmptyStateCopy("I could not load this video's details right now.");
      console.error("Clipchat context error:", error);
    }
  }

  async function prepareClipchatAssets(currentVideoId) {
    try {
      const response = await fetch(`/clipchat/${currentVideoId}/prepare`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to prepare Clipchat assets.");
      }

      const data = await response.json();
      videoContext = data;
      renderVideoContext(currentVideoId, data);
      applyTrialState(data.trial);
    } catch (error) {
      console.error("Clipchat preparation error:", error);
      setEmptyStateCopy(
        "I could not finish preparing the transcript and summary for this video.",
      );
      setComposerAvailability(
        false,
        "Clipchat is still preparing this video...",
      );
      return;
    }

    setPreparationState(false);
  }

  function setComposerAvailability(isEnabled, placeholderText) {
    if (!input || !submitButton) return;

    input.disabled = !isEnabled;
    submitButton.disabled = !isEnabled;
    input.placeholder = placeholderText;
  }

  function setPreparationState(isPreparing) {
    const titleElement = document.getElementById("clipchat-video-title");
    const summaryElement = document.getElementById("clipchat-summary");

    if (isPreparing) {
      if (titleElement && (!videoContext || !videoContext.video_title)) {
        titleElement.textContent = "Preparing Clipchat...";
      }
      if (summaryElement) {
        summaryElement.textContent =
          "Preparing transcript and summary for this video. This usually takes a few moments the first time.";
      }
      setEmptyStateCopy(
        "Preparing transcript and summary for this video. You will be able to chat as soon as everything is ready.",
      );
      setComposerAvailability(
        false,
        "Preparing transcript and summary...",
      );
      return;
    }

    if (videoId && videoContext && !needsAssetPreparation(videoContext.asset_status)) {
      const placeholderText = isGuest 
        ? "Ask about key ideas, moments, or exact timestamps from the transcript. Create an account to save notes and unlock the dashboard." 
        : "Ask about key ideas, moments, or exact timestamps from the transcript.";
      setComposerAvailability(true, placeholderText);
    }
  }

  function applyTrialState(trial, options = {}) {
    if (!isGuest) return;

    const details = trial || videoContext?.trial;
    if (!details) return;

    const videosUsed = Number(details.videos_used || 0);
    const videoLimit = Number(details.video_limit || 1);
    const queriesRemaining = Number(
      details.queries_remaining_for_video ??
        details.queries_per_video_limit ??
        0,
    );

    if (videoContext) {
      videoContext.trial = { ...videoContext.trial, ...details };
    }

    const queriesUsed = Number(details.queries_used_for_video || 0);
    const hasReachedQuestionLimit = queriesRemaining <= 0;
    const hasReachedVideoLimit = videosUsed >= videoLimit && queriesUsed === 0;

    if (
      options.lockComposer ||
      hasReachedQuestionLimit ||
      hasReachedVideoLimit
    ) {
      setComposerAvailability(
        false,
        "GPUs need to eat! Create an account to keep chatting.",
      );

      if (!hasShownLimitModal) {
        const fallbackMessage = hasReachedQuestionLimit
          ? "Beep boop! 🤖 You've used your 5 free questions for this video. GPUs need to eat too, and inference costs are adding up! Please create an account to support us."
          : "Whoa there! You've hit your 1-video free trial limit. Our GPUs are sweating and inference ain't cheap! 😅 Create an account to support the app and keep chatting.";
        showClipchatLimitModal(options.message || fallbackMessage);
        hasShownLimitModal = true;
      }
    }

    if (limitModalCopy && !hasReachedQuestionLimit && !hasReachedVideoLimit) {
      limitModalCopy.textContent =
        "Whoa there! You've hit your free trial limit. GPUs aren't free! 😅 Create an account to support the app and keep chatting.";
    }
  }

  function showClipchatLimitModal(message) {
    if (!limitModal) return;
    if (limitModalCopy) {
      limitModalCopy.textContent =
        message ||
        "Whoa there! You've hit your free trial limit. GPUs aren't free! 😅 Create an account to support the app and keep chatting.";
    }
    limitModal.style.display = "flex";
  }

  function persistUpdatedToken(headers) {
    const refreshedToken = headers.get("X-Clipnote-Access-Token");
    if (!refreshedToken) return;

    token = refreshedToken;
    localStorage.setItem("clipnote_token", refreshedToken);
  }

  function renderVideoContext(currentVideoId, data) {
    const titleElement = document.getElementById("clipchat-video-title");
    const videoLink = document.getElementById("clipchat-video-link");
    const summaryElement = document.getElementById("clipchat-summary");

    if (titleElement)
      titleElement.textContent = data.video_title || "Untitled video";
    if (videoLink) videoLink.href = data.video_url || "#";
    if (summaryElement) {
      summaryElement.textContent =
        data.video_summary ||
        "No saved summary is available yet. Clipchat will answer from the transcript.";
    }
    if (
      (data.asset_status?.transcript_source === "fetched" ||
        data.asset_status?.summary_source === "generated") &&
      emptyState
    ) {
      const copyText = isGuest
        ? "Ask about key ideas, moments, or exact timestamps from the transcript. Create an account to save notes and unlock the dashboard."
        : "Ask about key ideas, moments, or exact timestamps from the transcript.";
      setEmptyStateCopy(copyText);
    }
    initialiseThumbnail(currentVideoId, data.video_title || "Video thumbnail");
  }

  function initialiseThumbnail(currentVideoId) {
    const embed = document.getElementById("clipchat-thumbnail");
    const loader = document.getElementById("clipchat-thumbnail-loader");
    if (!embed) return;

    if (embed.dataset.videoId === currentVideoId && embed.getAttribute("src")) {
      return;
    }

    if (loader) loader.style.display = "flex";
    embed.classList.remove("is-loaded");
    embed.dataset.videoId = currentVideoId;

    embed.onload = () => {
      embed.classList.add("is-loaded");
      if (loader) loader.style.display = "none";
    };

    embed.src = `https://www.youtube.com/embed/${currentVideoId}?enablejsapi=1`;
  }

  function needsAssetPreparation(assetStatus) {
    return (
      !assetStatus ||
      assetStatus.transcript !== "ready" ||
      assetStatus.summary !== "ready"
    );
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
    link.href = "#";
    link.className = "clipchat-inline-link clipchat-timestamp-link";
    link.dataset.seconds = seconds;
    link.textContent = displayTimestamp;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      seekEmbedToSeconds(seconds);
    });

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

function seekEmbedToSeconds(seconds) {
  const embed = document.getElementById("clipchat-thumbnail");
  if (!embed || !embed.contentWindow) return;
  const cmd = (func, args) =>
    embed.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  cmd("seekTo", [seconds, true]);
  cmd("playVideo", []);
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
  const isGuest = isGuestAccessToken(token);

  const dashboardBtn = document.getElementById("dashboard-btn");
  if (dashboardBtn && !isGuest) {
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

  if (profilePlaceholder && !isGuest) {
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

  if (isGuest && dropdown) {
    dropdown.classList.remove("show");
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
  const badge = document.getElementById("dropdown-guest-info");
  if (badge) {
    badge.style.display = "none";
  }
}

function setupClipchatLimitModal() {
  const limitModal = document.getElementById("clipchat-limit-modal");
  const cancelLimit = document.getElementById("cancel-clipchat-limit");

  if (!limitModal) return;

  if (cancelLimit) {
    cancelLimit.addEventListener("click", () => {
      limitModal.style.display = "none";
    });
  }

  limitModal.addEventListener("click", (event) => {
    if (event.target === limitModal) {
      limitModal.style.display = "none";
    }
  });
}

function readTrialStateFromHeaders(headers) {
  if (!headers) return null;

  const videosUsed = Number(headers.get("X-Clipnote-Trial-Videos-Used"));
  const videoLimit = Number(headers.get("X-Clipnote-Trial-Video-Limit"));
  const queriesUsed = Number(headers.get("X-Clipnote-Trial-Queries-Used"));
  const queriesRemaining = Number(
    headers.get("X-Clipnote-Trial-Queries-Remaining"),
  );

  if (
    [videosUsed, videoLimit, queriesUsed, queriesRemaining].some(Number.isNaN)
  ) {
    return null;
  }

  return {
    videos_used: videosUsed,
    video_limit: videoLimit,
    queries_used_for_video: queriesUsed,
    queries_remaining_for_video: queriesRemaining,
  };
}

function getClipchatVideoIdFromLocation() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (pathParts[0] === "clipchat" && pathParts[1]) {
    return pathParts[1];
  }

  const urlParams = new URLSearchParams(window.location.search);
  return extractYouTubeVideoId(urlParams.get("video") || "");
}

function extractYouTubeVideoId(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(rawValue)) {
    return rawValue;
  }

  try {
    const url = new URL(rawValue);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "").slice(0, 11);
    }
    return url.searchParams.get("v") || "";
  } catch (error) {
    return "";
  }
}

function isGuestAccessToken(token) {
  const payload = parseAccessTokenPayload(token);
  return (
    payload?.sub?.startsWith("guest_") ||
    payload?.account_tier === "clipchat_trial"
  );
}

function parseAccessTokenPayload(token) {
  if (!token) return null;

  try {
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return null;

    const normalised = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalised));
  } catch (error) {
    console.error("Failed to parse access token payload:", error);
    return null;
  }
}
