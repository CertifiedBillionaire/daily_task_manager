/* --- ENTIRE FILE REPLACEMENT --- */

// This file is a module that exports functions to initialize the issues table.
// We are only importing initIssueOptions here to make sure it's available.
import { initIssueOptions } from './issueOptions.js';


export function initIssuesTable() {
    const issuesTableBody = document.getElementById('issuesTableBody');
    const noIssuesMessage = document.getElementById('noIssuesMessage');


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
                    
                    // Create color-coded badges for priority and status
                    const priorityBadge = `<span class="priority-badge ${issue.priority}">${issue.priority}</span>`;
                    const statusBadge = `<span class="status-badge ${issue.status}">${issue.status}</span>`;

                    // We need a unique ID for each row to handle the options menu
                    row.dataset.issueId = issue.id;

                    // The class names here now match what's in issueOptions.js and issues_table_menu.css
                    row.innerHTML = `
                        <td>${issue.id}</td>
                        <td>${issue.priority}</td>
                        <td>${issue.date_added}</td>
                        <td>${issue.last_update}</td>
                        <td>${issue.area}</td>
                        <td>${issue.equipment_name}</td>
                        <td>${issue.problem_description}</td>
                        <td>${issue.notes}</td>
                        <td class="issue-status">${issue.status}</td>
                        <td>${issue.target_date}</td>
                        <td>${issue.assigned_employee}</td>
                        
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

/* --- END ENTIRE FILE REPLACEMENT --- */