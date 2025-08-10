// =========================================================================
// ARCADE MANAGER - ADD NEW ISSUE FORM MODULE
// This module handles the collapsible behavior and future submission logic
// for the "Add New Issue" form on the Issues Management page.
// =========================================================================

/**
 * Sets up collapsible behavior for a given header and its content.
 * This is a reusable utility function.
 * @param {string} headerId The ID of the clickable header element.
 * @param {string} contentClass The class name of the collapsible content element.
 */
function setupCollapsible(headerId, contentClass) {
    const header = document.getElementById(headerId);
    if (header) {
        // Find the content div immediately following the header
        const content = header.nextElementSibling; 
        if (content && content.classList.contains(contentClass)) {
            header.addEventListener('click', () => {
                header.classList.toggle('active');
                content.classList.toggle('active');
            });
        } else {
            console.warn(`Collapsible setup: Content element with class '${contentClass}' not found after header '${headerId}'.`);
        }
    } else {
        console.warn(`Collapsible setup: Header element with ID '${headerId}' not found.`);
    }
}

/**
 * Initializes the "Add New Issue" form's collapsible behavior.
 * This function should be called when the Issues Management page is loaded.
 */
export function initAddNewIssueForm() {
    // Setup the collapsible behavior for the "Add New Issue" section
    setupCollapsible('addNewIssueToggle', 'collapsible-content');
    console.log("Add New Issue form collapsible behavior initialized.");
}
