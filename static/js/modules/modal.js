// =========================================================================
// MODAL CONTROLLER - modal.js (UPDATED)
// This file is in charge of opening and closing any pop-up.
// =========================================================================

/**
 * This job makes a pop-up appear on the screen.
 * @param {string} modalId - The ID of the pop-up part of the page.
 */
export function openModal(modalId) {
    // We get the actual pop-up element from its ID.
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        // We tell the pop-up to show itself by adding the word 'active' to it.
        modalElement.classList.add('active');
    } else {
        console.error(`Error: Modal with ID "${modalId}" not found.`);
    }
}

/**
 * This job makes a pop-up disappear from the screen.
 * @param {string} modalId - The ID of the pop-up part of the page.
 */
export function closeModal(modalId) {
    // We get the actual pop-up element from its ID.
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        // We tell the pop-up to hide itself by taking away the word 'active' from it.
        modalElement.classList.remove('active');
    } else {
        console.error(`Error: Modal with ID "${modalId}" not found.`);
    }
}