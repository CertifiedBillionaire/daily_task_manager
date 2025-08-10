// =========================================================================
// ARCADE MANAGER - TABLE RENDERER MODULE
// This module is responsible for rendering the issues table, including
// applying column widths directly to cells and managing fixed row counts.
// =========================================================================

const DEFAULT_ROWS_TO_RENDER = 25; // How many rows to always display in the table

// Helper function to format a date string (will be moved to a shared utility later)
// Duplicated here for now to ensure this module works independently.
function formatDate(dateString) {
    if (!dateString) {
        return '';
    }
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date in renderer:", dateString, e);
        return '';
    }
}

/**
 * Renders the issues table with provided data, applying column widths directly to cells,
 * and ensuring a fixed number of rows.
 * @param {Array} issues An array of issue objects to render.
 */
export function renderIssuesTable(issues) {
    const issuesTableBody = document.getElementById('issuesTableBody');
    const noIssuesMessage = document.getElementById('noIssuesMessage');
    const tableHeaders = document.querySelectorAll('.issues-table th'); // Get current headers for widths

    if (!issuesTableBody || !noIssuesMessage || tableHeaders.length === 0) {
        console.error("Table Renderer: Required HTML elements not found for rendering.");
        return;
    }

    // Clear existing rows
    issuesTableBody.innerHTML = '';

    // Hide "No issues found" message if we're always rendering rows, regardless of data
    noIssuesMessage.style.display = 'none';

    // Render actual issues
    issues.forEach(issue => {
        const row = document.createElement('tr');
        
        if (issue.priority === 'IMMEDIATE') {
            row.classList.add('priority-IMMEDIATE');
        }
        
        row.dataset.issueId = issue.id;

        // Create cells and apply widths directly
        const cells = [
            issue.id,
            issue.priority,
            issue.date_logged,
            issue.last_updated,
            issue.area,
            issue.equipment_location,
            issue.description,
            issue.notes,
            issue.status,
            issue.target_date,
            issue.assigned_to,
            // Last cell for menu container, no direct data value
            '' 
        ];

        cells.forEach((cellValue, colIndex) => {
            const td = document.createElement('td');
            td.textContent = cellValue;
            
            // Apply width from the corresponding header to the cell
            // This is crucial for linking td width to th width
            if (tableHeaders[colIndex]) {
                td.style.width = tableHeaders[colIndex].style.width;
            }

            // Apply specific classes for badges if needed (re-add logic from issuesTable.js)
            if (colIndex === 1) { // Priority column
                td.innerHTML = `<span class="priority-badge ${issue.priority}">${issue.priority}</span>`;
            } else if (colIndex === 8) { // Status column
                td.innerHTML = `<span class="status-badge ${issue.status}">${issue.status}</span>`;
            } else if (colIndex === 11) { // Last column for menu
                 td.innerHTML = `
                    <td class="menu-container">
                        <button class="issue-options-button" aria-label="Issue Options">
                            <span class="dot"></span>
                            <span class="dot"></span>
                            <span class="dot"></span>
                        </button>
                        <ul class="issue-options-menu hidden">
                            <li class="menu-item" data-action="edit">Edit Issue</li>
                            <li class="menu-item" data-action="mark-resolved">Mark as Resolved</li>
                            <li class="menu-item" data-action="assign-employee">Assign to Employee</li>
                            <li class="menu-item red" data-action="delete">Delete Issue</li>
                        </ul>
                    </td>
                `;
            }

            row.appendChild(td);
        });
        issuesTableBody.appendChild(row);
    });

    // Add empty rows to reach DEFAULT_ROWS_TO_RENDER
    const existingRowCount = issues.length;
    if (existingRowCount < DEFAULT_ROWS_TO_RENDER) {
        for (let i = existingRowCount; i < DEFAULT_ROWS_TO_RENDER; i++) {
            const emptyRow = document.createElement('tr');
            // Create 12 empty cells (matching the number of columns in your header)
            for (let j = 0; j < tableHeaders.length; j++) {
                const emptyTd = document.createElement('td');
                // Apply width from the corresponding header to the empty cell
                if (tableHeaders[j]) {
                    emptyTd.style.width = tableHeaders[j].style.width;
                }
                emptyRow.appendChild(emptyTd);
            }
            issuesTableBody.appendChild(emptyRow);
        }
        console.log(`Added ${DEFAULT_ROWS_TO_RENDER - existingRowCount} empty placeholder rows.`);
    }

    // Show "No issues found" message if no actual issues AND no empty rows are rendered (shouldn't happen with fixed rows)
    if (issues.length === 0 && DEFAULT_ROWS_TO_RENDER === 0) {
        noIssuesMessage.style.display = 'block';
    }
}
