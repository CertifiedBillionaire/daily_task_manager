// =========================================================================
// MODAL LISTENERS - modalListeners.js
// This file listens for clicks that should close any pop-up.
// =========================================================================

// This file needs to know how to close a modal. We get that job from our modal.js file.
import { closeModal } from './modal.js';

// This is the main job that starts everything in this file.
export function initModalListeners() {
    
    // We listen for a click anywhere on the whole page.
    document.addEventListener('click', (event) => {
        // We find the pop-up that is open right now.
        const activeModal = document.querySelector('.popup-overlay.active');
        
        // If there is no pop-up open, we stop here.
        if (!activeModal) {
            return;
        }

        // We find the 'X' button inside the pop-up.
        const closeButton = activeModal.querySelector('.close-modal-button');
        
        // We check if the click was on the 'X' button OR if the click was outside the pop-up box.
        if (event.target === closeButton || !activeModal.contains(event.target)) {
            // We tell the pop-up to close.
            closeModal(opening-checklist-modal);
        }
    });

}