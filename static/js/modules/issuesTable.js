/* --- ENTIRE FILE REPLACEMENT --- */

// This file is a module that exports functions to fetch issues data.
// It now uses tableRenderer.js to handle the actual rendering.

// --- NEW CODE HERE ---
// Import the renderIssuesTable function from the new tableRenderer module
import { renderIssuesTable } from './tableRenderer.js';
// --- END NEW CODE ---

/**
 * Helper function to format a date string into YYYY-MM-DD.
 * Returns an empty string if the date is null or invalid.
 * This function is duplicated here and in tableRenderer.js for now.
 * It will be moved to a shared utility in a future step.
 * @param {string|null} dateString The date string from the API.
 * @returns {string} Formatted date (YYYY-MM-DD) or empty string.
 */
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
        console.error("Error formatting date in issuesTable.js:", dateString, e);
        return '';
    }
}

/**
 * Fetches issues data from the API and formats relevant fields.
 * This function is now responsible ONLY for data retrieval and basic formatting.
 * @returns {Promise<Array>} A promise that resolves to an array of formatted issue objects.
 */
async function fetchIssuesData() {
    try {
        const response = await fetch('/api/issues');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const issues = await response.json();

        // Format dates and ensure all properties exist for consistent rendering
        return issues.map(issue => ({
            id: issue.id || '',
            priority: issue.priority || '',
            date_logged: formatDate(issue.date_logged),
            last_updated: formatDate(issue.last_updated),
            area: issue.area || '',
            equipment_location: issue.equipment_location || '',
            description: issue.description || '',
            notes: issue.notes || '',
            status: issue.status || '',
            target_date: formatDate(issue.target_date),
            assigned_to: issue.assigned_to || ''
        }));

    } catch (error) {
        console.error('Failed to fetch issues data:', error);
        return []; 
    }
}

// Exported function to refresh the issues table data.
// This will be called by other modules (e.g., addNewIssueForm.js)
// It now returns the fetched data for external rendering.
export async function refreshIssuesTableData() {
    const issues = await fetchIssuesData();
    // --- NEW CODE HERE ---
    renderIssuesTable(issues); // Call the renderer to update the table
    // --- END NEW CODE ---
    return issues; // Still return issues if other modules need them
}

// initIssuesTable now just calls fetchIssuesData and then renders it.
export async function initIssuesTable() {
    console.log("Issues Table Data Module Initialized.");
    const issues = await fetchIssuesData();
    // --- NEW CODE HERE ---
    renderIssuesTable(issues); // Render the initial table
    // --- END NEW CODE ---
    return issues;
}
