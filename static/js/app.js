/* --- ENTIRE FILE REPLACEMENT --- */
// Import must be at the very top of the file
// This file will now import a special 'open' job from the checklist file.
import { initOpeningChecklist } from './modules/openingChecklist.js';
import { updateChecklistProgress } from './modules/openingChecklist.js';
import { initContextMenu } from './modules/contextMenu.js';
import { initModalListeners } from './modules/modalListeners.js';
import { initSidebar } from './modules/sidebar.js';
import { initNewIssueCard } from './modules/addNewIssue.js';
import { initPMCard } from './modules/pmCard.js';
// We are removing 'initOptionsMenu' from the import because it's no longer needed.
import { initIssuesTable } from './modules/issuesTable.js';
import { closeModal } from './modules/modal.js';
import { initIssueOptions } from './modules/issueOptions.js';


// Then, we wait for the HTML to be ready
document.addEventListener('DOMContentLoaded', () => {
    
    
    
    // --- FIXED ---
    // The code to find the button is placed here with the other setup logic.
    const closeChecklistButton = document.getElementById('closeChecklistModalButton');
    if (closeChecklistButton) {
        closeChecklistButton.addEventListener('click', () => {
            closeModal('opening-checklist-modal');
        });
    }

    // We run the checklist setup just once when the page loads.
    // This gives us back the special job to open the checklist.
    const checklistApp = initOpeningChecklist();

    // --- Centralized Click Listener for Dashboard Cards ---
    const dashboardGrid = document.querySelector('.dashboard-grid');

    if (dashboardGrid) {
        dashboardGrid.addEventListener('click', (event) => {
            const clickedCard = event.target.closest('.dashboard-card');
            const clickedMenuButton = event.target.closest('.card-menu-button');
            
            if (clickedMenuButton) {
                return;
            }

            if (clickedCard) {
                const cardId = clickedCard.id;
                const cardColor = clickedCard.dataset.color;
                
                if (cardId === 'startOpeningChecklist') {
                    const root = document.documentElement;
                    if (cardColor === 'yellow') {
                        root.style.setProperty('--modal-primary-color', 'var(--secondary-accent-color)');
                    } else if (cardColor === 'blue') {
                        root.style.setProperty('--modal-primary-color', 'var(--primary-color)');
                    }
                    
                    // --- THE FIX IS HERE ---
                    // We use the special job to open the modal now.
                    if (checklistApp && checklistApp.openChecklistModal) {
                        checklistApp.openChecklistModal();
                    }
                        
                    
                }
            }
        });
    }

    // --- Run the other app logic ---
    updateChecklistProgress();
    initContextMenu();
    initSidebar();
    initModalListeners();
    initNewIssueCard();
    initPMCard();
    if (window.location.pathname === '/issues') {
        // Now that issuesTable.js only has one exported function, we call it here.
        initIssuesTable();
        // And we call the function for the options menu separately.
        initIssueOptions();
    }

});
/* --- END ENTIRE FILE REPLACEMENT --- */