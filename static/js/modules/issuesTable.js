/* --- ENTIRE FILE REPLACEMENT --- */

// This file is a module that exports functions to initialize the issues table.
// We are only importing initIssueOptions here to make sure it's available.
import { initIssueOptions } from './issueOptions.js';

// --- NEW CODE HERE ---
// Exported function to refresh the issues table.
// This will be called by other modules (e.g., addNewIssueForm.js)
export function refreshIssuesTable() {
    fetchAndRenderIssues();
}
// --- END NEW CODE ---

export function initIssuesTable() {
    const issuesTableBody = document.getElementById('issuesTableBody');
    const noIssuesMessage = document.getElementById('noIssuesMessage');

    const DEFAULT_ROWS_TO_RENDER = 15; // Set a default number of rows to always display
    // You can increase this to 150 or more once confident in performance.
    // For now, 15 is good for testing.

    /**
     * Helper function to format a date string into YYYY-MM-DD.
     * Returns an empty string if the date is null or invalid.
     * @param {string|null} dateString The date string from the API.
     * @returns {string} Formatted date (YYYY-MM-DD) or empty string.
     */
    function formatDate(dateString) {
        if (!dateString) {
            return '';
        }
        try {
            const date = new Date(dateString);
            // Check if date is valid (e.g., avoids "Invalid Date" issues)
            if (isNaN(date.getTime())) {
                return '';
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return ''; // Return empty string on error
        }
    }

    // This is the main function that fetches and renders the issues.
    // It is now a local function, called by initIssuesTable and refreshIssuesTable.
    async function fetchAndRenderIssues() {
        // --- MODIFIED CODE HERE ---
        // Always clear the table body completely before rendering new data
        if (issuesTableBody) {
            issuesTableBody.innerHTML = '';
        }
        // --- END MODIFIED CODE ---

        try {
            const response = await fetch('/api/issues');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const issues = await response.json();

            if (issues.length === 0) {
                // Hide the "No issues found" message if we're always rendering rows
                if (noIssuesMessage) {
                    noIssuesMessage.style.display = 'none';
                }
            } else {
                // Hide the "No issues found" message if there are issues
                if (noIssuesMessage) {
                    noIssuesMessage.style.display = 'none';
                }

                // Render each issue as a new table row
                issues.forEach(issue => {
                    const row = document.createElement('tr');
                    
                    // Add a class to the row for a hover effect
                    if (issue.priority === 'IMMEDIATE') {
                        row.classList.add('priority-IMMEDIATE');
                    }
                    
                    row.dataset.issueId = issue.id;

                    const formattedDateLogged = formatDate(issue.date_logged);
                    const formattedLastUpdated = formatDate(issue.last_updated);
                    const formattedTargetDate = formatDate(issue.target_date); 

                    row.innerHTML = `
                        <td>${issue.id || ''}</td>
                        <td>${issue.priority || ''}</td>
                        <td>${formattedDateLogged}</td>
                        <td>${formattedLastUpdated}</td>
                        <td>${issue.area || ''}</td>
                        <td>${issue.equipment_location || ''}</td>
                        <td>${issue.description || ''}</td>
                        <td>${issue.notes || ''}</td>
                        <td class="issue-status">${issue.status || ''}</td>
                        <td>${formattedTargetDate}</td>
                        <td>${issue.assigned_to || ''}</td>
                        
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
                    
                    if (issuesTableBody) {
                        issuesTableBody.appendChild(row);
                    }
                });
            }

            // Add empty rows if the total number of issues is less than DEFAULT_ROWS_TO_RENDER
            const existingRowCount = issues.length;
            if (existingRowCount < DEFAULT_ROWS_TO_RENDER) {
                for (let i = existingRowCount; i < DEFAULT_ROWS_TO_RENDER; i++) {
                    const emptyRow = document.createElement('tr');
                    // Create 12 empty cells (matching the number of columns in your header)
                    emptyRow.innerHTML = `
                        <td></td><td></td><td></td><td></td><td></td><td></td>
                        <td></td><td></td><td></td><td></td><td></td><td></td>
                    `;
                    if (issuesTableBody) {
                        issuesTableBody.appendChild(emptyRow);
                    }
                }
                console.log(`Added ${DEFAULT_ROWS_TO_RENDER - existingRowCount} empty rows.`);
            }

        } catch (error) {
            // Display an error message if the fetch fails
            console.error('Failed to fetch issues:', error);
            if (issuesTableBody) {
                issuesTableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #f44336;">Error loading issues. Please check the server.</td></tr>';
            }
        }
    }

    // This is the main initialization function
    fetchAndRenderIssues();
}
