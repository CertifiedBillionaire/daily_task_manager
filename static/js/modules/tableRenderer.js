// =========================================================================
// ARCADE MANAGER - TABLE RENDERER MODULE (Issues)
// Renders the Issues table with a padded display number (001, 002, …),
// keeps the real ID for actions, and preserves fixed placeholder rows.
//
// What this file does:
// - Renders issues into #issuesTableBody
// - First column shows a DISPLAY number (001…) instead of the raw ID
// - Keeps real issue id on the row (data-issue-id) and as a tooltip on the number
// - Leaves menu/actions markup intact
// - Fills up to DEFAULT_ROWS_TO_RENDER with empty rows to keep layout steady
//
// Connected files:
// - templates/issues.html (table structure/headers)
// - static/css/components/table.css (you can center .num-cell here if desired)
// - static/js/modules/issueInlineEditor.js / issueOptions.js (actions wiring)
// =========================================================================

const DEFAULT_ROWS_TO_RENDER = 25; // How many rows to always display in the table

// Helper: format date -> YYYY-MM-DD (kept here for module independence)
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (e) {
    console.error("Error formatting date in renderer:", dateString, e);
    return '';
  }
}

/**
 * Render the issues table.
 * @param {Array} issues - list of issue objects
 */
export function renderIssuesTable(issues) {
  const tbody = document.getElementById('issuesTableBody');
  const noIssuesMessage = document.getElementById('noIssuesMessage');
  const tableHeaders = document.querySelectorAll('.issues-table th');

  if (!tbody || !noIssuesMessage || tableHeaders.length === 0) {
    console.error("Table Renderer: Required HTML elements not found for rendering.");
    return;
  }

  // Clear existing rows
  tbody.innerHTML = '';
  noIssuesMessage.style.display = 'none';

  // Render actual issues
  issues.forEach((issue, index) => {
    const row = document.createElement('tr');

    // highlight immediate priority row
    if (issue.priority === 'IMMEDIATE') {
      row.classList.add('priority-IMMEDIATE');
    }

    // keep the REAL id on the row for edit/delete wiring
    row.dataset.issueId = issue.id;

    // DISPLAY number (001-based)
    const displayNo = String(index + 1).padStart(3, '0');

    // Build cell values in order of your header (12 cols total):
    // 0: DISPLAY No. (001), 1: Priority, 2: Date Added, 3: Last Update,
    // 4: Area, 5: Equipment/Location, 6: Description, 7: Notes,
    // 8: Status, 9: Target Date, 10: Assigned To, 11: Actions menu
    const cells = [
      displayNo,                         // shows 001-style number
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
      ''                                 // actions/menu container
    ];

    cells.forEach((val, colIndex) => {
      const td = document.createElement('td');

      // Default: text content
      td.textContent = val ?? '';

      // Special renderers by column:
      if (colIndex === 0) {
        // DISPLAY number cell
        td.classList.add('num-cell');
        td.title = `Real ID: ${issue.id}`;       // hover shows the actual ID
        td.setAttribute('data-real-id', issue.id);
      } else if (colIndex === 1) {
        // Priority badge
        td.innerHTML = `<span class="priority-badge ${issue.priority}">${issue.priority}</span>`;
      } else if (colIndex === 2) {
        // Date Added (optional: format to date-only)
        td.textContent = formatDate(issue.date_logged);
      } else if (colIndex === 3) {
        // Last Update (optional: format to date-only)
        td.textContent = formatDate(issue.last_updated);
      } else if (colIndex === 8) {
        // Status badge
        td.innerHTML = `<span class="status-badge ${issue.status}">${issue.status}</span>`;
      } else if (colIndex === 9) {
        // Target Date (optional: date-only)
        td.textContent = formatDate(issue.target_date);
      } else if (colIndex === 11) {
        // Actions menu (3-dot)
        td.classList.add('menu-container');
        td.innerHTML = `
          <button class="issue-options-button" aria-label="Issue Options">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </button>
          <ul class="issue-options-menu hidden">
            <li class="menu-item" data-action="edit">Edit Issue</li>
            <li class="menu-item" data-action="mark-resolved">Mark as Resolved</li>
            <li class="menu-item" data-action="assign-employee">Assign to Employee</li>
            <li class="menu-item red" data-action="delete">Delete Issue</li>
          </ul>
        `;
      }

      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  // Add empty rows up to DEFAULT_ROWS_TO_RENDER to keep layout steady
  const existing = issues.length;
  if (existing < DEFAULT_ROWS_TO_RENDER) {
    for (let i = existing; i < DEFAULT_ROWS_TO_RENDER; i++) {
      const emptyRow = document.createElement('tr');
      for (let j = 0; j < tableHeaders.length; j++) {
        emptyRow.appendChild(document.createElement('td'));
      }
      tbody.appendChild(emptyRow);
    }
  }

  // If you ever set DEFAULT_ROWS_TO_RENDER = 0, show "no issues" message
  if (issues.length === 0 && DEFAULT_ROWS_TO_RENDER === 0) {
    noIssuesMessage.style.display = 'block';
  }
}
