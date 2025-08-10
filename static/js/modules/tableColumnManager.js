// =========================================================================
// ARCADE MANAGER - TABLE COLUMN MANAGER MODULE
// This module handles column-specific interactions like selection and alignment.
// =========================================================================

export function initTableColumnManager() {
    const table = document.querySelector('.issues-table');
    const headers = table ? table.querySelectorAll('th') : [];
    const toolbar = document.getElementById('columnAlignmentToolbar');

    if (!table || headers.length === 0 || !toolbar) {
        console.warn("Table Column Manager: Required elements (table, headers, or toolbar) not found. Functionality will not be active.");
        return;
    }

    let activeHeader = null; // Stores the currently selected <th> element

    /**
     * Shows the toolbar at the position of the clicked header.
     * @param {HTMLElement} header The <th> element that was clicked.
     */
    function showToolbar(header) {
        activeHeader = header;
        // Get header's position and size
        const headerRect = header.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect(); // Get table's position relative to viewport

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

    // Add click listeners to each table header
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

    console.log("Table Column Manager initialized.");
}
