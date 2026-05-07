document.addEventListener("DOMContentLoaded", function () {
    insertDashboardIconIfLoggedIn();
    setupThemeToggle();
    loadProfileInfo();
    loadLabels();
    setupTokenControls();
    setupAddLabel();
    setupChangePassword();
    checkGuestProfileStatus();
});

const token = localStorage.getItem("clipnote_token");

if (!token) {
    window.location.href = "/login";
}

if (isGuestAccessToken(token)) {
    window.location.href = "/clipchat";
}

function loadProfileInfo() {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const username = payload.username || payload.sub || 'User';
        const email = payload.email || '';
        const picture = payload.picture || null;
        const accountTier = payload.account_tier;

        document.getElementById('profile-username-display').textContent = username;
        document.getElementById('profile-email-display').textContent = email;

        // Avatar: Google photo or initials
        const avatarEl = document.getElementById('profile-avatar-initials');
        if (avatarEl) {
            if (picture) {
                avatarEl.innerHTML = `<img src="${picture}" alt="${username}" class="profile-avatar-img" />`;
            } else {
                avatarEl.textContent = username.slice(0, 2).toUpperCase();
            }
        }

        // Subscription tier badge
        const tierBadge = document.getElementById('profile-tier-badge');
        if (tierBadge) {
            if (accountTier === 'clipchat_trial') {
                tierBadge.textContent = 'Clipchat Trial';
                tierBadge.className = 'profile-tier-badge tier-trial';
            } else {
                tierBadge.textContent = 'Bring Your Own Key';
                tierBadge.className = 'profile-tier-badge tier-byok';
            }
        }
    } catch (e) {
        console.error("Invalid token", e);
        document.getElementById('profile-username-display').textContent = 'Unknown User';
        document.getElementById('profile-email-display').textContent = '';
    }

    document.getElementById('jwt-token').value = token;
}

function setupAddLabel() {
    const form = document.getElementById('label-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-label-input');
        const labelName = input.value.trim();
        if (!labelName) return;

        fetch('/label', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ label_name: labelName }),
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to add label.');
                return res.json();
            })
            .then(() => {
                input.value = '';
                loadLabels();
            })
            .catch(() => alert('Failed to add label.'));
    });
}

function setupTokenControls() {
    const tokenInput = document.getElementById('jwt-token');
    const toggleBtn = document.getElementById('toggle-token-btn');
    const copyBtn = document.getElementById('copy-token-btn');

    toggleBtn.addEventListener('click', () => {
        const type = tokenInput.getAttribute('type') === 'password' ? 'text' : 'password';
        tokenInput.setAttribute('type', type);


        const iconName = type === 'password' ? 'eye' : 'eye-off';

        toggleBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(token).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = `<i data-lucide="check"></i>`;
            lucide.createIcons();

            setTimeout(() => {
                copyBtn.innerHTML = `<i data-lucide="copy"></i>`;
                lucide.createIcons();
            }, 2000);
        });
    });
}

function loadLabels() {
    const listContainer = document.getElementById('labels-list');

    fetch("/labels", {
        headers: { Authorization: "Bearer " + token },
    })
        .then(res => res.json())
        .then(labels => {
            listContainer.innerHTML = '';

            if (labels.length === 0) {
                listContainer.innerHTML = '<p class="no-data">No labels created yet.</p>';
                return;
            }

            labels.forEach(label => {
                const item = document.createElement('div');
                item.className = 'label-list-item';

                item.innerHTML = `
                <div class="label-info">
                    <span class="label-name">${label.label_name}</span>
                </div>
                <div class="label-actions">
                    <button class="icon-btn edit-label-btn" title="Edit">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="icon-btn delete-label-btn" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

                // Edit Action
                item.querySelector('.edit-label-btn').addEventListener('click', () => {
                    const newName = prompt("Enter new label name:", label.label_name);
                    if (newName && newName.trim() !== "" && newName !== label.label_name) {
                        updateLabel(label.id, newName.trim());
                    }
                });

                // Delete Action
                item.querySelector('.delete-label-btn').addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete label "${label.label_name}"?`)) {
                        deleteLabel(label.id);
                    }
                });

                listContainer.appendChild(item);
            });

            lucide.createIcons();
        })
        .catch(err => {
            console.error("Error loading labels:", err);
            listContainer.innerHTML = '<p class="error-text">Failed to load labels.</p>';
        });
}

function updateLabel(id, newName) {
    fetch("/label", {
        method: "PATCH",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ label_id: id, new_name: newName })
    })
        .then(res => {
            if (!res.ok) throw new Error("Failed update");
            loadLabels(); // Reload list
        })
        .catch(err => alert("Failed to update label"));
}

function deleteLabel(id) {
    fetch("/label", {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ label_id: id })
    })
        .then(res => {
            if (!res.ok) throw new Error("Failed delete");
            loadLabels(); // Reload list
        })
        .catch(err => alert("Failed to delete label"));
}

function setupChangePassword() {
    const form = document.getElementById('change-password-form');
    if (!form) return;

    const feedback = document.getElementById('password-feedback');

    const setFeedback = (msg, isError = true) => {
        feedback.textContent = msg;
        feedback.className = 'password-feedback ' + (isError ? 'feedback-error' : 'feedback-success');
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const current = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-password').value;

        if (newPass !== confirm) {
            setFeedback('New passwords do not match.');
            return;
        }
        if (newPass.length < 6) {
            setFeedback('Password must be at least 6 characters.');
            return;
        }

        feedback.textContent = '';

        fetch('/change-password', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ current_password: current, new_password: newPass }),
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (ok) {
                    setFeedback(data.message || 'Password updated.', false);
                    form.reset();
                } else {
                    setFeedback(data.message || 'Failed to update password.');
                }
            })
            .catch(() => setFeedback('Something went wrong. Please try again.'));
    });
}

function insertDashboardIconIfLoggedIn() {
    const token = localStorage.getItem("clipnote_token");
    if (!token) return;
    const isGuest = isGuestAccessToken(token);

    // Clipchat Icon
    const clipchatNavBtn = document.getElementById("clipchat-nav-btn");
    if (clipchatNavBtn && !isGuest) {
        clipchatNavBtn.style.display = "flex";
        clipchatNavBtn.addEventListener("click", () => {
            window.location.href = "/clipchat";
        });
    }

    // Dashboard Icon
    const dashboardBtn = document.getElementById("dashboard-btn");
    if (dashboardBtn && !isGuest) {
        dashboardBtn.style.display = "flex";
        dashboardBtn.addEventListener("click", () => {
            window.location.href = "/dashboard";
        });
        if (window.lucide) lucide.createIcons();
    }

    // Profile Icon & Dropdown
    const profilePlaceholder = document.getElementById("profile-icon-placeholder");
    const dropdown = document.getElementById("profile-dropdown");
    const manageBtn = document.getElementById("manage-profile-btn");
    const logoutTrigger = document.getElementById("logout-trigger-btn");

    // Modal Elements
    const logoutModal = document.getElementById("logout-modal");
    const cancelLogout = document.getElementById("cancel-logout");
    const confirmLogout = document.getElementById("confirm-logout");

    if (profilePlaceholder && !isGuest) {
        profilePlaceholder.style.display = "flex";

        // Toggle Dropdown
        profilePlaceholder.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        });

        // Close dropdown on outside click
        document.addEventListener("click", (e) => {
            if (!profilePlaceholder.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove("show");
            }
        });

        // Dropdown Actions
        if (manageBtn) {
            manageBtn.addEventListener("click", () => {
                window.location.href = "/profile";
            });
        }

        if (logoutTrigger) {
            logoutTrigger.addEventListener("click", () => {
                dropdown.classList.remove("show");
                logoutModal.style.display = "flex";
            });
        }

        if (window.lucide) lucide.createIcons();
    }

    // Modal Logic
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

        // Close modal on outside click
        logoutModal.addEventListener("click", (e) => {
            if (e.target === logoutModal) {
                logoutModal.style.display = "none";
            }
        });
    }
}

function isGuestAccessToken(token) {
    const payload = parseAccessTokenPayload(token);
    return payload?.sub?.startsWith("guest_") || payload?.account_tier === "clipchat_trial";
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

        updateIcon(isLight);
    };

    const savedTheme = localStorage.getItem("theme");
    applyTheme(savedTheme === "light");

    toggleBtn.addEventListener("click", () => {
        const isLight = body.classList.contains("light-mode");
        applyTheme(!isLight);
    });
}

function checkGuestProfileStatus() {
    const info = document.getElementById('guest-profile-info');
    if (info) {
        info.style.display = "none";
    }

    const dropdownBadge = document.getElementById("dropdown-guest-info");
    if (dropdownBadge) {
        dropdownBadge.style.display = "none";
    }
}
