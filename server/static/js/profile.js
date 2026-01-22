document.addEventListener("DOMContentLoaded", function () {
    insertDashboardIconIfLoggedIn();
    setupThemeToggle();
    loadProfileInfo();
    loadLabels();
    setupTokenControls();
});

const token = localStorage.getItem("clipnote_token");

if (!token) {
    window.location.href = "/login";
}

function loadProfileInfo() {
    // Decode JWT to get username
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('profile-username-display').textContent = payload.sub || 'User';
    } catch (e) {
        console.error("Invalid token", e);
        document.getElementById('profile-username-display').textContent = 'Unknown User';
    }

    // Set token value
    document.getElementById('jwt-token').value = token;
}

function setupTokenControls() {
    const tokenInput = document.getElementById('jwt-token');
    const toggleBtn = document.getElementById('toggle-token-btn');
    const copyBtn = document.getElementById('copy-token-btn');

    toggleBtn.addEventListener('click', () => {
        const type = tokenInput.getAttribute('type') === 'password' ? 'text' : 'password';
        tokenInput.setAttribute('type', type);

        // Update icon
        const iconName = type === 'password' ? 'eye' : 'eye-off';
        // Re-render lucide icon
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

    // Profile Icon
    const profilePlaceholder = document.getElementById("profile-icon-placeholder");
    if (profilePlaceholder) {
        profilePlaceholder.style.display = "flex";
        profilePlaceholder.addEventListener("click", () => {
            window.location.href = "/profile";
        });
        if (window.lucide) lucide.createIcons();
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
