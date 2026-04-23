document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();
  setupPasswordToggle();

  let EXT_ID = document.documentElement.getAttribute(
    "data-clipnote-extension-id",
  );

  window.addEventListener("clipnote-extension-ready", (e) => {
    EXT_ID = e.detail.extensionId;
    console.log("Extension ID discovered:", EXT_ID);
  });

  const token = localStorage.getItem("clipnote_token");
  if (token && !isGuestAccessToken(token)) {
    window.location.href = getPostLoginDestination(token);
    return;
  }

  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  const loginTitle = document.getElementById("login-title");
  const submitBtn = document.getElementById("submit-btn");
  const toggleLink = document.getElementById("toggle-form");
  const toggleText = document.getElementById("toggle-text");

  let isSignup = false;

  function applyAuthMode() {
    loginTitle.textContent = isSignup ? "Sign Up" : "Login";
    submitBtn.textContent = isSignup ? "Sign Up" : "Login";
    toggleText.textContent = isSignup
      ? "Already have an account?"
      : "Don't have an account?";
    toggleLink.textContent = isSignup ? "Login" : "Sign up";

    if (usernameInput) {
      usernameInput.style.display = isSignup ? "block" : "none";
      usernameInput.required = isSignup;
      usernameInput.value = isSignup ? usernameInput.value : "";
    }

    if (emailInput) {
      emailInput.placeholder = "Email";
      emailInput.autocomplete = isSignup ? "email" : "username";
    }

    if (passwordInput) {
      passwordInput.autocomplete = isSignup
        ? "new-password"
        : "current-password";
    }

    errorMsg.style.display = "none";
  }

  if (toggleLink) {
    toggleLink.addEventListener("click", (e) => {
      e.preventDefault();
      isSignup = !isSignup;
      applyAuthMode();
    });
  }

  applyAuthMode();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = String(form.username?.value || "").trim();
    const email = String(form.email.value || "")
      .trim()
      .toLowerCase();
    const password = form.password.value;
    const endpoint = isSignup ? "/signup" : "/login";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      errorMsg.style.display = "block";
      errorMsg.textContent =
        data.message || (isSignup ? "Signup failed." : "Invalid credentials.");
      return;
    }

    const { access_token } = await res.json();
    localStorage.setItem("clipnote_token", access_token);

    if (window.chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        EXT_ID,
        { type: "SET_TOKEN", jwt: access_token },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Extension error:", chrome.runtime.lastError);
          }
          window.location.href = getPostLoginDestination(access_token);
        },
      );
    } else {
      window.location.href = getPostLoginDestination(access_token);
    }
  });

  const googleBtn = document.getElementById("google-login-btn");
  if (googleBtn) {
    googleBtn.addEventListener("click", function () {
      window.location.href = "/login/google";
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const googleToken = urlParams.get("access_token");
  if (googleToken) {
    localStorage.setItem("clipnote_token", googleToken);
    window.location.href = getPostLoginDestination(googleToken);
  }
  const guestBtn = document.getElementById("guest-btn");
  if (guestBtn) {
    guestBtn.addEventListener("click", async () => {
      const res = await fetch("/trial-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        errorMsg.style.display = "block";
        errorMsg.textContent = "Failed to start the Clipchat trial.";
        return;
      }

      const { access_token } = await res.json();
      localStorage.setItem("clipnote_token", access_token);

      if (window.chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          EXT_ID,
          { type: "SET_TOKEN", jwt: access_token },
          (response) => {
            window.location.href = getPostLoginDestination(access_token);
          },
        );
      } else {
        window.location.href = getPostLoginDestination(access_token);
      }
    });
  }
});

function getPostLoginDestination(token) {
  return isGuestAccessToken(token) ? "/clipchat" : "/dashboard";
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

function setupThemeToggle() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const body = document.body;

  if (!toggleBtn) return;

  const updateIcon = (isLight) => {
    const iconName = isLight ? "moon" : "sun";
    toggleBtn.innerHTML = `<i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>`;
    if (window.lucide) lucide.createIcons();
  };

  const applyTheme = (isLight) => {
    body.classList.toggle("light-mode", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
    updateIcon(isLight);

    const logoImg = document.getElementById("login-logo-img");
    if (logoImg) {
      logoImg.src = isLight ? logoImg.dataset.light : logoImg.dataset.dark;
    }
  };

  const savedTheme = localStorage.getItem("theme");
  applyTheme(savedTheme === "light");

  toggleBtn.addEventListener("click", () => {
    const isLight = body.classList.contains("light-mode");
    applyTheme(!isLight);
  });
}

function setupPasswordToggle() {
  const toggleBtn = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");

  if (!toggleBtn || !passwordInput) return;

  toggleBtn.addEventListener("click", () => {
    const type =
      passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);

    const iconName = type === "password" ? "eye" : "eye-off";
    toggleBtn.innerHTML = `<i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>`;

    if (window.lucide) lucide.createIcons();
  });
}
