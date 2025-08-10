// =========================================================================
// ARCADE MANAGER - TABLE COLUMN MANAGER MODULE
// This module handles column-specific interactions like selection and alignment.
// =========================================================================

export function initTableColumnManager() {
    const table = document.querySelector('.issues-table');
    const headers = table ? table.querySelectorAll('th') : [];
    const toolbar = document.getElementById('columnAlignmentToolbar'); // This is the old floating toolbar, will be removed later.
    const issuesToolbarToggle = document.getElementById('issuesToolbarToggle'); // NEW: Reference to the new standstill toolbar header

    if (!table || headers.length === 0 || !toolbar || !issuesToolbarToggle) { // Added issuesToolbarToggle to check
        console.warn("Table Column Manager: Required elements (table, headers, or toolbars) not found. Functionality will not be active.");
        return;
    }

    let activeHeader = null; // Stores the currently selected <th> element

    // --- NEW CODE HERE ---
    /**
     * Reusable function to set up collapsible behavior for a header and its content.
     * Duplicated here for now; can be refactored to a shared utility later.
     * @param {string} headerId The ID of the clickable header element.
     * @param {string} contentClass The class name of the collapsible content element.
     */
    function setupCollapsible(headerId, contentClass) {
        const header = document.getElementById(headerId);
        if (header) {
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
    // --- END NEW CODE ---

    /**
     * Shows the toolbar at the position of the clicked header.
     * @param {HTMLElement} header The <th> element that was clicked.
     */
    function showToolbar(header) {
        activeHeader = header;
        // Get header's position and size
        const headerRect = header.getBoundingClientRect();
        // const tableRect = table.getBoundingClientRect(); // tableRect is not used in positioning here.

        // Position the toolbar relative to the main content area (or viewport)
        // Adjust these values based on your layout to fine-tune positioning
        toolbar.style.left = `${headerRect.left + (headerRect.width / 2) - (toolbar.offsetWidth / 2)}px`;
        toolbar.style.top = `${headerRect.bottom + 5}px`; // 5px below the header

        toolbar.classList.add('visible');
        console.log("Toolbar shown for column:", header.textContent.trim());
    }

    /**
     * Hides the toolbar.
     */
    function hideToolbar() {
        toolbar.classList.remove('visible');
        activeHeader = null;
        console.log("Toolbar hidden.");
    }

    // Add click listeners to each table header (for the old floating toolbar)
    headers.forEach((header, index) => {
        // Skip the last header if it's just for the options menu and not a data column
        if (index === headers.length - 1 && header.textContent.trim() === '') {
            return; 
        }

        header.addEventListener('click', (event) => {
            // Prevent event from bubbling up and hiding the toolbar immediately
            event.stopPropagation(); 

            if (activeHeader === header) {
                // If clicking the same header, hide the toolbar
                hideToolbar();
            } else {
                // If clicking a new header, hide current and show for new
                hideToolbar(); // Hide any currently active toolbar
                showToolbar(header);
            }
        });
    });

    // Hide toolbar when clicking anywhere else on the document
    document.addEventListener('click', (event) => {
        // If the click is outside the toolbar and not on an active header
        if (!toolbar.contains(event.target) && !event.target.closest('th')) {
            hideToolbar();
        }
    });

    // Handle clicks on the toolbar buttons (alignment logic will go here later)
    toolbar.addEventListener('click', (event) => {
        const button = event.target.closest('.toolbar-button');
        if (button && activeHeader) {
            const align = button.dataset.align;
            console.log(`Alignment button clicked: ${align} for column: ${activeHeader.textContent.trim()}`);
            // --- Future: Apply alignment CSS and save to localStorage ---
            hideToolbar(); // Hide toolbar after selection
        }
    });

    // --- NEW CODE HERE ---
    // Initialize the new compact Issues Toolbar collapsible behavior
    setupCollapsible('issuesToolbarToggle', 'issues-toolbar-content');
    console.log("Compact Issues Toolbar collapsible behavior initialized.");
    // --- END NEW CODE ---

    console.log("Table Column Manager initialized.");
}
