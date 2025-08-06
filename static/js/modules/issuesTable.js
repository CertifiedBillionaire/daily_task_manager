// --- NEW CODE HERE ---
// --- FILE: issuesTable.js ---
// This file is a module that exports a function to initialize the issues table.

export function initIssuesTable() {
    const issuesTableBody = document.getElementById('issuesTableBody');
    const noIssuesMessage = document.getElementById('noIssuesMessage');

    async function fetchAndRenderIssues() {
        // Show a loading message while we fetch the data
        issuesTableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Loading issues...</td></tr>';

        try {
            const response = await fetch('/api/issues');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const issues = await response.json();

            // Clear the loading message
            issuesTableBody.innerHTML = '';
            
            if (issues.length === 0) {
                // Display the "No issues found" message
                noIssuesMessage.style.display = 'block';
            } else {
                // Hide the "No issues found" message if there are issues
                noIssuesMessage.style.display = 'none';

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

                    row.innerHTML = `
                        <td>${issue.id}</td>
                        <td>${priorityBadge}</td>
                        <td>${new Date(issue.date_logged).toLocaleDateString()}</td>
                        <td>${new Date(issue.last_updated).toLocaleDateString()}</td>
                        <td>${issue.area}</td>
                        <td>${issue.equipment_location}</td>
                        <td>${issue.description}</td>
                        <td>${issue.notes || ''}</td>
                        <td>${statusBadge}</td>
                        <td>${issue.target_date ? new Date(issue.target_date).toLocaleDateString() : ''}</td>
                        <td>${issue.assigned_to || ''}</td>
                        <td class="row-options-cell">
                            <div class="options-menu-container">
                                <button class="icon-button row-options-button" data-issue-id="${issue.id}">
                                    <i class="fa-solid fa-ellipsis-vertical"></i>
                                </button>
                                <div class="options-menu">
                                    <ul>
                                        <li data-action="edit">Edit</li>
                                        <li data-action="delete">Delete</li>
                                    </ul>
                                </div>
                            </div>
                        </td>
                    `;
                    issuesTableBody.appendChild(row);
                });
            }

        } catch (error) {
            // Display an error message if the fetch fails
            console.error('Failed to fetch issues:', error);
            issuesTableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #f44336;">Error loading issues. Please check the server.</td></tr>';
        }
    }

    // Call the function to fetch and render issues when the page loads
    fetchAndRenderIssues();
}

// --- NEW CODE HERE ---
// This function handles the logic for the options menu
export function initOptionsMenu() {
    issuesTableBody.addEventListener('click', (event) => {
        const button = event.target.closest('.row-options-button');
        if (button) {
            // Prevent the click from bubbling up and closing the menu
            event.stopPropagation();
            
            const menuContainer = button.closest('.options-menu-container');
            const menu = menuContainer.querySelector('.options-menu');

            // Close any other open menus
            document.querySelectorAll('.options-menu.active').forEach(openMenu => {
                if (openMenu !== menu) {
                    openMenu.classList.remove('active');
                }
            });

            // Toggle the 'active' class on the clicked menu
            menu.classList.toggle('active');
        }
    });

    // Close the menu if the user clicks anywhere else on the page
    document.addEventListener('click', (event) => {
        document.querySelectorAll('.options-menu.active').forEach(openMenu => {
            openMenu.classList.remove('active');
        });
    });
}
// --- END NEW CODE ---