/* =========================================================================
// ARCADE MANAGER - ROBUST TABLE RESIZER MODULE (v4 - Exportable)
// This version is designed to be imported and called by a main script (app.js)
// ========================================================================= */

const STORAGE_KEY = 'issuesTableColumnWidths';

/**
 * Initializes the resizable table functionality.
 * This function is exported to be called by another module.
 */
export function initTableResizers() {
    const table = document.querySelector('.issues-table');
    if (!table) {
        console.warn("Resizer v4: '.issues-table' not found.");
        return;
    }

    const cols = table.querySelectorAll('colgroup > col');
    if (cols.length === 0) {
        console.warn("Resizer v4: Table is missing <colgroup> elements.");
        return;
    }

    loadColumnWidths(table, cols);

    cols.forEach((col, index) => {
        const header = table.querySelector(`thead th:nth-child(${index + 1})`);
        const resizer = header ? header.querySelector('.resizer') : null;
        if (resizer) {
            resizer.addEventListener('mousedown', (e) => mouseDownHandler(e, col, table));
        }
    });

    console.log('Table Resizer v4 Initialized.');
}

function loadColumnWidths(table, cols) {
    const savedWidths = localStorage.getItem(STORAGE_KEY);
    // Provide a fallback empty array if nothing is saved.
    const widths = savedWidths ? JSON.parse(savedWidths) : [];
    let totalTableWidth = 0;

    cols.forEach((col, index) => {
        const savedWidth = parseInt(widths[index], 10);
        // Use saved width or a default of 150px.
        const widthToApply = !isNaN(savedWidth) && savedWidth > 40 ? savedWidth : 150;
        col.style.width = `${widthToApply}px`;
        totalTableWidth += widthToApply;
    });
    table.style.width = `${totalTableWidth}px`;
}

function saveColumnWidths(cols) {
    const widths = Array.from(cols).map(col => parseInt(col.style.width, 10));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    console.log('Resizer v4: Widths saved.');
}

// --- Event handler logic ---
let startX, startWidth, tableStartWidth, currentResizingCol, currentTable;

function mouseDownHandler(e, col, table) {
    e.preventDefault();
    startX = e.clientX;
    currentResizingCol = col;
    currentTable = table;
    startWidth = parseInt(col.style.width, 10);
    tableStartWidth = parseInt(table.style.width, 10);
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
}

function mouseMoveHandler(e) {
    if (!currentResizingCol) return;
    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;
    if (newWidth > 50) { // Set a minimum column width
        currentResizingCol.style.width = `${newWidth}px`;
        currentTable.style.width = `${tableStartWidth + deltaX}px`;
    }
}

function mouseUpHandler() {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    if (currentTable) {
        saveColumnWidths(currentTable.querySelectorAll('colgroup > col'));
    }
}