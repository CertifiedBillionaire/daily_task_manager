// Import must be at the very top of the file
// This file will now import a special 'open' job from the checklist file.
import { initOpeningChecklist } from './modules/openingChecklist.js';
import { updateChecklistProgress } from './modules/openingChecklist.js';
import { initContextMenu } from './modules/contextMenu.js';
import { initModalListeners } from './modules/modalListeners.js';
// --- FIXED ---
// We need to import the closeModal tool from modal.js here at the top.
import { closeModal } from './modules/modal.js';

// Then, we wait for the HTML to be ready
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Mobile Sidebar Menu Logic ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    if (hamburgerMenu && sidebar) {
        const openSidebar = () => {
            sidebar.classList.add('sidebar-open');
            overlay.classList.add('active');
        };

        const closeSidebar = () => {
            sidebar.classList.remove('sidebar-open');
            overlay.classList.remove('active');
        };

        hamburgerMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });

        overlay.addEventListener('click', closeSidebar);
    }
    
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
    initModalListeners();
});