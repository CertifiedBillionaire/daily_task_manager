// Import must be at the very top of the file
import initOpeningChecklist from './modules/openingChecklist.js';
import { checklistSteps, updateChecklistProgress } from './modules/openingChecklist.js';

// Then, we wait for the HTML to be ready
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Mobile Sidebar Menu Logic ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.querySelector('.sidebar');

    if (hamburgerMenu && sidebar) {
        // Create the overlay element if it doesn't exist
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

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

    // --- Run the Checklist Logic ---
    // Now we call the function that was imported at the top
    initOpeningChecklist();

        // Update the progress tracker when the page loads
    updateChecklistProgress();

});