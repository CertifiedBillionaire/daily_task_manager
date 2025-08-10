// =========================================================================
// ARCADE MANAGER - TABLE COLUMN MANAGER MODULE
// This module handles column-specific interactions like selection and alignment.
// =========================================================================

export function initTableColumnManager() {
    const table = document.querySelector('.issues-table');
    const headers = table ? table.querySelectorAll('th') : [];
    // const toolbar = document.getElementById('columnAlignmentToolbar'); // REMOVED: No longer needed
    const issuesToolbarToggle = document.getElementById('issuesToolbarToggle'); // Reference to the new compact toolbar header

    // Removed 'toolbar' from the check, as it's no longer needed
    if (!table || headers.length === 0 || !issuesToolbarToggle) { 
        console.warn("Table Column Manager: Required elements (table, headers, or compact toolbar toggle) not found. Functionality will not be active.");
        return;
    }

    // activeHeader is still useful for future column selection logic
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
                    // --- NEW CODE HERE ---
                    console.log("Issues Toolbar Toggle clicked!"); // Test if click is registered
                    // --- END NEW CODE ---
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

    // REMOVED: showToolbar and hideToolbar functions are no longer needed for the floating toolbar.
    /*
    function showToolbar(header) { ... }
    function hideToolbar() { ... }
    */

    // REMOVED: Click listeners for each table header to show/hide the floating toolbar
    /*
    headers.forEach((header, index) => { ... });
    */

    // REMOVED: Hide toolbar when clicking anywhere else on the document
    /*
    document.addEventListener('click', (event) => { ... });
    */

    // REMOVED: Handle clicks on the floating toolbar buttons
    /*
    toolbar.addEventListener('click', (event) => { ... });
    */

    // Initialize the new compact Issues Toolbar collapsible behavior
    setupCollapsible('issuesToolbarToggle', 'toolbar-buttons-group'); // MODIFIED: contentClass is now 'toolbar-buttons-group'
    console.log("Compact Issues Toolbar collapsible behavior initialized.");

    console.log("Table Column Manager initialized.");
}
