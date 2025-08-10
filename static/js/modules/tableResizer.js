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

    // --- MODIFIED CODE HERE ---
    // Function to handle the mouse move event (actual resizing logic)
    function mouseMoveHandler(e) {
        // Prevent text selection during drag
        e.preventDefault(); 

        // Calculate the new width
        const newWidth = startWidth + (e.clientX - startX);
        
        // Apply the new width to the current header
        // Ensure minimum width to prevent columns from disappearing or becoming too small
        const MIN_WIDTH = 50; // pixels
        if (newWidth > MIN_WIDTH) {
            currentHeader.style.width = `${newWidth}px`;
            // console.log(`Resizing column: ${currentHeader.textContent.trim()}, New Width: ${newWidth}px`); // For debugging
        }
    }
    // --- END MODIFIED CODE ---

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
