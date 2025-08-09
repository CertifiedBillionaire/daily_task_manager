// =========================================================================
// ARCADE MANAGER - SETTINGS MODULE
// This module handles application settings and reset functionalities.
// =========================================================================

/**
 * Resets the completion status of the "Start Opening Checklist" card.
 * This will remove the grayed-out effect and clear its localStorage flag.
 */
export function resetOpeningChecklistStatus() {
    // 1. Clear the localStorage flag
    localStorage.removeItem('isOpeningChecklistCompleted');
    console.log("Opening Checklist completion status cleared from localStorage.");

    // 2. Find the dashboard card
    const startOpeningChecklistCard = document.getElementById('startOpeningChecklist');

    // 3. Remove the 'completed' class if the card exists
    if (startOpeningChecklistCard) {
        startOpeningChecklistCard.classList.remove('completed');
        console.log("Opening Checklist card un-grayed.");
    }

    // 4. Provide user feedback (e.g., a toast notification)
    // Assuming you have a global function for displaying toasts, like in app.js
    // If not, this part might need adjustment later.
    if (typeof window.showToast === 'function') { // Check if showToast exists
        window.showToast("Opening Checklist status has been reset!", "Success", 3000);
    } else {
        console.log("Toast function not found, please implement showToast for user feedback.");
        alert("Opening Checklist status has been reset!"); // Fallback alert
    }
}

/**
 * Initializes listeners for buttons on the Settings page.
 * This function should be called when the Settings page is loaded.
 */
export function initSettingsPageListeners() {
    const resetOpeningChecklistBtn = document.getElementById('resetOpeningChecklistBtn');

    if (resetOpeningChecklistBtn) {
        resetOpeningChecklistBtn.addEventListener('click', () => {
            // Confirm with the user before resetting
            const confirmation = confirm("Are you sure you want to reset the 'Start Opening Checklist' status? This will un-gray the card on the Dashboard.");
            if (confirmation) {
                resetOpeningChecklistStatus();
            } else {
                console.log("Reset Opening Checklist cancelled by user.");
            }
        });
    } else {
        console.warn("Settings: Reset Opening Checklist button not found.");
    }
}
