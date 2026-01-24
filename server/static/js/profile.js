document.addEventListener("DOMContentLoaded", function () {
    insertDashboardIconIfLoggedIn();
    setupThemeToggle();
    loadProfileInfo();
    loadLabels();
    setupTokenControls();
    checkGuestProfileStatus();
});

const token = localStorage.getItem("clipnote_token");

if (!token) {
    window.location.href = "/login";
}

function loadProfileInfo() {

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('profile-username-display').textContent = payload.username || payload.sub || 'User';
    } catch (e) {
        console.error("Invalid token", e);
        document.getElementById('profile-username-display').textContent = 'Unknown User';
    }


    document.getElementById('jwt-token').value = token;
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

function insertDashboardIconIfLoggedIn() {
    const token = localStorage.getItem("clipnote_token");
    if (!token) return;

    // Dashboard Icon
    const dashboardBtn = document.getElementById("dashboard-btn");
    if (dashboardBtn) {
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

    if (profilePlaceholder) {
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
    const token = localStorage.getItem("clipnote_token");
    if (!token) return;

    fetch("/user-status", {
        headers: { Authorization: "Bearer " + token },
    })
        .then(res => res.json())
        .then(data => {
            if (data.is_guest) {
                const display = document.getElementById('profile-username-display');
                if (display) display.textContent = "Guest User";

                const info = document.getElementById('guest-profile-info');
                if (info) {
                    const days = data.days_remaining;
                    const hours = data.hours_remaining;
                    let timeText = "";
                    if (days > 0) {
                        timeText = `${days} days, ${hours} hours`;
                    } else {
                        timeText = `${hours} hours`;
                    }

                    info.innerText = `Guest Account: Trial ends in ${timeText}`;
                    info.style.display = "block";

                    // Update Dropdown Info as well
                    const dropdownBadge = document.getElementById("dropdown-guest-info");
                    if (dropdownBadge) {
                        let shortText = (days > 0) ? `${days}d ${hours}h left` : `${hours}h left`;
                        dropdownBadge.innerHTML = `<span style="display:block; font-size:0.75rem; opacity:0.8;">Trial Expires In:</span> ${shortText}`;
                        dropdownBadge.style.display = "block";
                    }
                }
            }
        })
        .catch(err => console.error("Error checking guest status:", err));
}
