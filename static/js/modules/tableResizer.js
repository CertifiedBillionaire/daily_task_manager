// =========================================================================
// ARCADE MANAGER - TABLE RESIZER MODULE
// This module enables draggable and resizable columns for HTML tables.
// =========================================================================

export function initTableResizers() {
    const table = document.querySelector('.issues-table');
    if (!table) {
        console.warn("Table Resizer: '.issues-table' not found. Resizer functionality will not be active.");
        return;
    }

    const headers = table.querySelectorAll('th');
    let currentResizer;
    let startX;
    let startWidth;
    let currentHeader; // The <th> element being resized

    // Function to handle the mouse down event on a resizer
    function mouseDownHandler(e) {
        currentResizer = e.target;
        currentHeader = currentResizer.parentElement; // The <th> element
        startX = e.clientX; // Initial mouse X position
        startWidth = currentHeader.offsetWidth; // Initial width of the header

        // Add class to resizer for visual feedback (e.g., highlight)
        currentResizer.classList.add('is-resizing');

        // Attach event listeners to document for mousemove and mouseup
        // This is crucial to allow dragging outside the header itself
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        console.log("Resizing started for column:", currentHeader.textContent.trim());
    }

    // Function to handle the mouse move event (actual resizing logic will go here later)
    function mouseMoveHandler(e) {
        // Prevent text selection during drag
        e.preventDefault(); 

        // For now, just log that dragging is happening
        // console.log("Resizing column:", currentHeader.textContent.trim(), "Current X:", e.clientX);
    }

    // Function to handle the mouse up event (stop resizing)
    function mouseUpHandler() {
        // Remove the resizing class
        currentResizer.classList.remove('is-resizing');

        // Remove event listeners from document
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        console.log("Resizing stopped for column:", currentHeader.textContent.trim());

        // --- Future Step: Save column widths to localStorage here ---
    }

    // Attach mouse down listeners to all resizer elements
    headers.forEach(header => {
        const resizer = header.querySelector('.resizer');
        // Only attach if a resizer exists in the header (e.g., not the last column)
        if (resizer) {
            resizer.addEventListener('mousedown', mouseDownHandler);
        }
    });

    console.log("Table resizers initialized.");
}
