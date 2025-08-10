// =========================================================================
// ARCADE MANAGER - TABLE COLUMN MANAGER MODULE
// This module handles column-specific interactions like selection and alignment.
// =========================================================================

export function initTableColumnManager() {
    const table = document.querySelector('.issues-table');
    const headers = table ? table.querySelectorAll('th') : [];
    const issuesToolbarToggle = document.getElementById('issuesToolbarToggle'); // Reference to the new compact toolbar header

    if (!table || headers.length === 0 || !issuesToolbarToggle) { 
        console.warn("Table Column Manager: Required elements (table, headers, or compact toolbar toggle) not found. Functionality will not be active.");
        return;
    }

    let activeHeader = null; 

    /**
     * Reusable function to set up collapsible behavior for a header and its content.
     * @param {string} headerId The ID of the clickable header element.
     * @param {string} contentClass The class name of the collapsible content element.
     */
    function setupCollapsible(headerId, contentClass) {
        const header = document.getElementById(headerId);
        if (header) {
            const content = header.nextElementSibling; 
            if (content && content.classList.contains(contentClass)) {
                header.addEventListener('click', () => {
                    console.log("Issues Toolbar Toggle clicked!"); // Test if click is registered
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

    // Initialize the new compact Issues Toolbar collapsible behavior
    // --- MODIFIED CODE HERE ---
    setupCollapsible('issuesToolbarToggle', 'toolbar-buttons-group'); // CORRECTED: contentClass is now 'toolbar-buttons-group'
    // --- END MODIFIED CODE ---
    console.log("Compact Issues Toolbar collapsible behavior initialized.");

    console.log("Table Column Manager initialized.");
}
