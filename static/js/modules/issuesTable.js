// --- NEW CODE HERE ---
// --- NEW FILE: issuesTable.js ---
// This file is now a module that exports a function to initialize the issues table.

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
                    row.innerHTML = `
                        <td>${issue.id}</td>
                        <td>${issue.priority}</td>
                        <td>${new Date(issue.date_logged).toLocaleDateString()}</td>
                        <td>${new Date(issue.last_updated).toLocaleDateString()}</td>
                        <td>${issue.area}</td>
                        <td>${issue.equipment_location}</td>
                        <td>${issue.description}</td>
                        <td>${issue.notes || ''}</td>
                        <td>${issue.status}</td>
                        <td>${issue.target_date ? new Date(issue.target_date).toLocaleDateString() : ''}</td>
                        <td>${issue.assigned_to || ''}</td>
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
// --- END NEW CODE ---