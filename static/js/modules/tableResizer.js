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
    let initialTableWidth; // To store the table's width when resizing starts
    let currentColumnCells; // NEW: To store all <td> elements in the current column

    // Define default widths for each column in pixels
    // These values are chosen to provide a good initial layout for your table.
    // Adjust these values as needed for your specific content.
    const DEFAULT_COLUMN_WIDTHS = [
        100, // Issue ID
        100, // Priority
        120, // Date Added
        120, // Last Update
        100, // Area
        150, // Equipment Name
        250, // Problem Description
        150, // Notes
        100, // Status
        120, // Target Date
        150, // Assigned Employee
        50   // Last column (options menu) - small fixed width
    ];

    // --- MODIFIED CODE HERE ---
    // Function to apply widths to both header and all cells in a column
    function applyColumnWidth(colIndex, width) {
        const header = headers[colIndex];
        if (header) {
            header.style.width = `${width}px`;
        }
        // Get all cells in this column (from all rows)
        const allCellsInColumn = table.querySelectorAll(`td:nth-child(${colIndex + 1})`);
        allCellsInColumn.forEach(cell => {
            cell.style.width = `${width}px`;
        });
    }

    // Try to load saved widths from localStorage, otherwise use defaults
    let loadedWidths = [];
    const savedWidths = localStorage.getItem('issuesTableColumnWidths');
    if (savedWidths) {
        try {
            loadedWidths = JSON.parse(savedWidths);
            // Basic validation: ensure loadedWidths has correct number of columns
            if (loadedWidths.length !== headers.length) {
                console.warn("Loaded column widths count mismatch. Using default widths.");
                loadedWidths = []; // Fallback to default if mismatch
            }
        } catch (e) {
            console.error("Error parsing saved column widths from localStorage:", e);
            loadedWidths = []; // Fallback to default on parse error
        }
    }

    // Apply initial/loaded widths on load to both TH and TD elements
    let totalTableWidth = 0;
    headers.forEach((header, index) => {
        const widthToApply = loadedWidths[index] || DEFAULT_COLUMN_WIDTHS[index];
        if (widthToApply) {
            applyColumnWidth(index, widthToApply); // Use the new helper function
            totalTableWidth += widthToApply;
        }
    });
    table.style.width = `${totalTableWidth}px`; // Set the overall table width
    console.log("Table initialized with column widths. Total width:", totalTableWidth, " (Loaded:", loadedWidths.length > 0, ")");
    // --- END MODIFIED CODE ---

    // Function to handle the mouse down event on a resizer
    function mouseDownHandler(e) {
        currentResizer = e.target;
        currentHeader = currentResizer.parentElement; // The <th> element
        const colIndex = Array.from(headers).indexOf(currentHeader); // Get the index of the current header
        currentColumnCells = table.querySelectorAll(`td:nth-child(${colIndex + 1})`); // NEW: Get all cells in this column

        startX = e.clientX; // Initial mouse X position
        startWidth = currentHeader.offsetWidth; // Initial width of the header
        initialTableWidth = table.offsetWidth; // Capture table's initial width

        // Add class to resizer for visual feedback (e.g., highlight)
        currentResizer.classList.add('is-resizing');

        // Attach event listeners to document for mousemove and mouseup
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        console.log("Resizing started for column:", currentHeader.textContent.trim());
    }

    // Function to handle the mouse move event (actual resizing logic)
    function mouseMoveHandler(e) {
        // Prevent text selection during drag
        e.preventDefault(); 

        const deltaX = e.clientX - startX; // How much the mouse has moved
        const newColumnWidth = startWidth + deltaX; // New width for the current column
        
        // Ensure minimum width for the column
        const MIN_COLUMN_WIDTH = 50; // pixels
        if (newColumnWidth > MIN_COLUMN_WIDTH) {
            // Apply new width to the header
            currentHeader.style.width = `${newColumnWidth}px`; 
            
            // NEW: Apply new width to all cells in the current column
            currentColumnCells.forEach(cell => {
                cell.style.width = `${newColumnWidth}px`;
            });

            // Adjust the overall table width
            table.style.width = `${initialTableWidth + deltaX}px`; 
        }
    }

    // Function to handle the mouse up event (stop resizing)
    function mouseUpHandler() {
        // Remove the resizing class
        currentResizer.classList.remove('is-resizing');

        // Remove event listeners from document
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        console.log("Resizing stopped for column:", currentHeader.textContent.trim());

        // Save current column widths to localStorage
        const currentColumnWidths = Array.from(headers).map(header => header.offsetWidth);
        localStorage.setItem('issuesTableColumnWidths', JSON.stringify(currentColumnWidths));
        console.log("Column widths saved to localStorage:", currentColumnWidths);
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
