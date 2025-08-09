// =========================================================================
// ARCADE MANAGER - SETTINGS MODULE
// This module handles application settings and reset functionalities.
// =========================================================================

// --- NEW CODE HERE ---
// Import the updateChecklistProgress function from the openingChecklist module
import { updateChecklistProgress } from './openingChecklist.js';
// --- END NEW CODE ---

/**
 * Resets the completion status of the "Start Opening Checklist" card.
 * This will remove the grayed-out effect and clear its localStorage flag.
 */
export function resetOpeningChecklistStatus() {
    // 1. Clear the localStorage flag for card completion
    localStorage.removeItem('isOpeningChecklistCompleted');
    console.log("Opening Checklist card completion status cleared from localStorage.");

    // 2. Clear the localStorage for individual checklist steps
    localStorage.removeItem('completedChecklistSteps');
    console.log("Opening Checklist individual steps progress cleared from localStorage.");

    // 3. Find the dashboard card
    const startOpeningChecklistCard = document.getElementById('startOpeningChecklist');

    // 4. Remove the 'completed' class if the card exists
    if (startOpeningChecklistCard) {
        startOpeningChecklistCard.classList.remove('completed');
        console.log("Opening Checklist card un-grayed.");
    }

    // 5. Update the progress display on the card to reflect the reset
    // This function needs to be imported from openingChecklist.js
    updateChecklistProgress(); 
    console.log("Opening Checklist progress display updated to 0/X Done.");

    // 6. Provide user feedback (e.g., a toast notification)
    if (typeof window.showToast === 'function') {
        window.showToast("Opening Checklist status and progress have been reset!", "Success", 3000);
    } else {
        console.log("Toast function not found, please implement showToast for user feedback.");
        alert("Opening Checklist status and progress have been reset!"); // Fallback alert
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
            const confirmation = confirm("Are you sure you want to reset the 'Start Opening Checklist' status and progress?");
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