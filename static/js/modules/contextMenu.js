// --- Import functions we need from other modules ---
import { updateChecklistProgress } from './openingChecklist.js';

// --- Module-level variables ---
let currentItemId = null; // This will store the ID of the card you clicked on
const contextMenu = document.getElementById('contextMenu');
const contextMenuList = document.getElementById('contextMenuList');
const contextMenuCloseBtn = document.getElementById('contextMenuCloseBtn');

/**
 * This function builds the menu's content based on which card was clicked.
 * @param {HTMLElement} card - The card element that was clicked.
 */
function buildMenuFor(card) {
    currentItemId = card.dataset.id;
    contextMenuList.innerHTML = ''; // Clear out any old options

    // Check which card was clicked and add the appropriate options
    if (currentItemId === 'opening-checklist') {
        const resetOption = document.createElement('li');
        resetOption.textContent = 'Reset Progress';
        resetOption.dataset.action = 'reset-checklist';
        contextMenuList.appendChild(resetOption);
    }

    // In the future, you can add more `if` statements here for other cards.
    // if (currentItemId === 'another-card') { ... }
}


/**
 * This is the main setup function for the context menu.
 */
export function initContextMenu() {
    // Safety check: if the HTML elements don't exist, stop.
    if (!contextMenu || !contextMenuList || !contextMenuCloseBtn) {
        return;
    }

    // This is the main listener for the whole page
    window.addEventListener('click', (event) => {
        const menuButton = event.target.closest('.card-menu-button');

        // If a 3-dot menu button was clicked...
        if (menuButton) {
            event.stopPropagation(); // Stop the card behind it from opening
            const card = menuButton.closest('.dashboard-card');
            buildMenuFor(card);      // Build the menu for that specific card
            contextMenu.classList.add('active'); // Show the menu
            return; // Stop processing this click
        }

        // If the click was inside the menu content, do nothing.
        if (event.target.closest('.popup-content')) {
            return;
        }

        // If the click was anywhere else, close the menu.
        contextMenu.classList.remove('active');
    });

    // This listener handles clicks on the options INSIDE the menu
    contextMenuList.addEventListener('click', (event) => {
        const action = event.target.dataset.action;

        if (action === 'reset-checklist') {
            // Clear the saved progress
            localStorage.removeItem('completedChecklistSteps');
            // Update the card's text to show "0/4 Done"
            updateChecklistProgress();
        }

        // Close the menu after the action is done
        contextMenu.classList.remove('active');
    });

    // Listener for the menu's own close button
    contextMenuCloseBtn.addEventListener('click', () => {
        contextMenu.classList.remove('active');
    });
}