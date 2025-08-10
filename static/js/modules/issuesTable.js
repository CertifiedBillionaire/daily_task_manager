/* --- ENTIRE FILE REPLACEMENT --- */

// This file is a module that exports functions to initialize the issues table.
// We are only importing initIssueOptions here to make sure it's available.
import { initIssueOptions } from './issueOptions.js';

export function initIssuesTable() {
    const issuesTableBody = document.getElementById('issuesTableBody');
    const noIssuesMessage = document.getElementById('noIssuesMessage');

    // --- NEW CODE HERE ---
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
    // --- END NEW CODE ---

    // This is the main function that fetches and renders the issues.
    async function fetchAndRenderIssues() {
        // Show a loading message while we fetch the data
        if (issuesTableBody) {
            issuesTableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Loading issues...</td></tr>';
        }

        try {
            const response = await fetch('/api/issues');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const issues = await response.json();

            // Clear the loading message
            if (issuesTableBody) {
                issuesTableBody.innerHTML = '';
            }
            
            if (issues.length === 0) {
                // Display the "No issues found" message
                if (noIssuesMessage) {
                    noIssuesMessage.style.display = 'block';
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
                    
                    // The class names here now match what's in issueOptions.js and issues_table_menu.css
                    row.dataset.issueId = issue.id;

                    // --- MODIFIED CODE HERE ---
                    // Use the formatDate helper and || '' operator for clean display
                    const formattedDateLogged = formatDate(issue.date_logged);
                    const formattedLastUpdated = formatDate(issue.last_updated);
                    const formattedTargetDate = formatDate(issue.target_date); // Format target date too

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
                    // --- END MODIFIED CODE ---
                    
                    if (issuesTableBody) {
                        issuesTableBody.appendChild(row);
                    }
                });
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
