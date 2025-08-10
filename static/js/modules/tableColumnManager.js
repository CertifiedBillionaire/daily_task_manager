// =========================================================================
// ARCADE MANAGER - TABLE COLUMN MANAGER MODULE
// This module handles column-specific interactions like selection and alignment.
// =========================================================================

export function initTableColumnManager() {
    const table = document.querySelector('.issues-table');
    const headers = table ? table.querySelectorAll('th') : [];
    const issuesToolbarToggle = document.getElementById('issuesToolbarToggle'); // Reference to the new compact toolbar header
    const issuesToolbarCompact = document.getElementById('issuesToolbarCompact'); // The toolbar container we want to open/close

    if (!table || headers.length === 0 || !issuesToolbarToggle || !issuesToolbarCompact) { 
        console.warn("Table Column Manager: Required elements (table, headers, toolbar toggle, or toolbar container) not found. Functionality will not be active.");
        return;
    }

    // --- NEW CODE HERE ---
    // Make the chevron toggle the whole compact toolbar by adding/removing 'active'
    issuesToolbarToggle.addEventListener('click', () => {
        console.log("Issues Toolbar Toggle clicked!");
        issuesToolbarCompact.classList.toggle('active'); // this triggers your CSS to expand/collapse
    });
    // --- END NEW CODE ---

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
    // --- NEW CODE HERE ---
    // setupCollapsible('issuesToolbarToggle', 'toolbar-buttons-group'); // (disabled) old approach toggled the wrong element
    console.log("Compact Issues Toolbar collapsible behavior initialized.");
    // --- END NEW CODE ---
}
