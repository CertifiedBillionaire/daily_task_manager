// static/js/modules/settings_status.js

document.addEventListener('DOMContentLoaded', () => {
    const databaseDot = document.getElementById('database-dot');
    const databaseMessage = document.getElementById('database-message');
    const storageDot = document.getElementById('storage-dot');
    const storageMessage = document.getElementById('storage-message');
    const issueApiDot = document.getElementById('issue-api-dot');
    const issueApiMessage = document.getElementById('issue-api-message');
    const refreshStatusBtn = document.getElementById('refreshStatusBtn');

    // ensure toast stack exists
    let toastStack = document.querySelector('.toast-stack');
    if (!toastStack) {
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    document.body.appendChild(toastStack);
    }

    function showToast(message, type = 'success', ms = 2500) {
    const el = document.createElement('div');
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    el.innerHTML = `<span>${message}</span> <span class="x" aria-label="Close">&times;</span>`;
    toastStack.appendChild(el);

    const close = () => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.x').addEventListener('click', close);

    const timer = setTimeout(close, ms);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => setTimeout(close, 800));
    }

    // Function to update the dot and message
    function updateStatusUI(dotElement, messageElement, status, message) {
        dotElement.classList.remove('ok', 'error', 'unknown');
        dotElement.classList.add(status);
        messageElement.textContent = message;
    }

    // Function to fetch and display health status
    async function fetchSystemStatus() {
        // Reset to unknown state while fetching
        updateStatusUI(databaseDot, databaseMessage, 'unknown', 'Checking...');
        updateStatusUI(storageDot, storageMessage, 'unknown', 'Checking...');
        updateStatusUI(issueApiDot, issueApiMessage, 'unknown', 'Checking...');

        try {
            const response = await fetch('/api/health');
            const data = await response.json();

            // Update UI for Database
            if (data.services.database) {
                updateStatusUI(databaseDot, databaseMessage, data.services.database.status, data.services.database.message);
            }
            // Update UI for Storage
            if (data.services.storage) {
                updateStatusUI(storageDot, storageMessage, data.services.storage.status, data.services.storage.message);
            }
            // Update UI for Issue API
            if (data.services.issue_api) {
                updateStatusUI(issueApiDot, issueApiMessage, data.services.issue_api.status, data.services.issue_api.message);
            }

        } catch (error) {
            console.error('Error fetching system status:', error);
            // Set all to error if API call fails
            updateStatusUI(databaseDot, databaseMessage, 'error', 'Failed to connect to health API.');
            updateStatusUI(storageDot, storageMessage, 'error', 'Failed to connect to health API.');
            updateStatusUI(issueApiDot, issueApiMessage, 'error', 'Failed to connect to health API.');
        }
    }

    // Add event listener for the refresh button
    refreshStatusBtn.addEventListener('click', fetchSystemStatus);

    // Fetch status on page load
    fetchSystemStatus();

    // Get the new reset button
    const resetIssueHubTableBtn = document.getElementById('resetIssueHubTableBtn');

    // Add a click listener to the new button
    resetIssueHubTableBtn.addEventListener('click', async () => {
    const yes = confirm("Are you sure you want to permanently delete all issues? This cannot be undone.");
    if (!yes) return;

    // 🔒 disable + show progress
    const oldLabel = resetIssueHubTableBtn.innerHTML;
    resetIssueHubTableBtn.disabled = true;
    resetIssueHubTableBtn.innerHTML = 'Resetting…';

    try {
        const res = await fetch('/api/issues/reset', { method: 'POST' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.success === false) {
        showToast(data.message || 'Reset failed.', 'error');
        return;
        }

        showToast(data.message || 'All issues cleared.', 'success');
        setTimeout(() => window.location.reload(), 900); // wait ~0.9s so toast is visible // keep if you like the auto-refresh
    } catch (err) {
        console.error(err);
        showToast('Network error. Check console.', 'error');
    } finally {
        // 🔓 re-enable (in case you remove reload)
        resetIssueHubTableBtn.disabled = false;
        resetIssueHubTableBtn.innerHTML = oldLabel;
    }
    });
});