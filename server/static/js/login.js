document.addEventListener("DOMContentLoaded", function () {
  setupThemeToggle();
  setupPasswordToggle();

  let EXT_ID = document.documentElement.getAttribute("data-clipnote-extension-id");

  window.addEventListener("clipnote-extension-ready", (e) => {
    EXT_ID = e.detail.extensionId;
    console.log("Extension ID discovered:", EXT_ID);
  });

  const token = localStorage.getItem("clipnote_token");
  if (token) {
    window.location.href = "/dashboard";
    return;
  }

  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");

  const loginTitle = document.getElementById("login-title");
  const submitBtn = document.getElementById("submit-btn");
  const toggleLink = document.getElementById("toggle-form");
  const toggleText = document.getElementById("toggle-text");

  let isSignup = false;

  if (toggleLink) {
    toggleLink.addEventListener("click", (e) => {
      e.preventDefault();
      isSignup = !isSignup;
      loginTitle.textContent = isSignup ? "Sign Up" : "Login";
      submitBtn.textContent = isSignup ? "Sign Up" : "Login";
      toggleText.textContent = isSignup ? "Already have an account?" : "Don't have an account?";
      toggleLink.textContent = isSignup ? "Login" : "Sign up";
      errorMsg.style.display = "none";
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = form.username.value;
    const password = form.password.value;
    const endpoint = isSignup ? "/signup" : "/login";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      errorMsg.style.display = "block";
      errorMsg.textContent = data.message || (isSignup ? "Signup failed." : "Invalid credentials.");
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
          window.location.href = "/dashboard";
        }
      );
    } else {
      window.location.href = "/dashboard";
    }
  });

  const guestBtn = document.getElementById("guest-btn");
  if (guestBtn) {
    guestBtn.addEventListener("click", async () => {
      const res = await fetch("/guest-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        errorMsg.style.display = "block";
        errorMsg.textContent = "Failed to create guest session.";
        return;
      }

      const { access_token } = await res.json();
      localStorage.setItem("clipnote_token", access_token);


      if (window.chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          EXT_ID,
          { type: "SET_TOKEN", jwt: access_token },
          (response) => {
            window.location.href = "/dashboard";
          }
        );
      } else {
        window.location.href = "/dashboard";
      }
    });
  }
});

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
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);


    const iconName = type === "password" ? "eye" : "eye-off";
    toggleBtn.innerHTML = `<i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>`;

    if (window.lucide) lucide.createIcons();
  });
}
