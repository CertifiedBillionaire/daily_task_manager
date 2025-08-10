// =========================================================================
// ARCADE MANAGER - TABLE RENDERER MODULE
// Renders the issues table and adds the pencil button per row.
// =========================================================================

import { openInlineEditorFor } from './issueInlineEditor.js';

const DEFAULT_ROWS_TO_RENDER = 25;

// format helper
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch (e) {
    console.error("Error formatting date in renderer:", dateString, e);
    return '';
  }
}

export function renderIssuesTable(issues) {
  const issuesTableBody = document.getElementById('issuesTableBody');
  const noIssuesMessage = document.getElementById('noIssuesMessage');
  const tableHeaders = document.querySelectorAll('.issues-table th');

  if (!issuesTableBody || !noIssuesMessage || tableHeaders.length === 0) {
    console.error("Table Renderer: Required HTML elements not found for rendering.");
    return;
  }

  // clear body
  issuesTableBody.innerHTML = '';
  noIssuesMessage.style.display = 'none';

  // render real rows
  issues.forEach(issue => {
    const row = document.createElement('tr');

    if (issue.priority === 'IMMEDIATE') {
      row.classList.add('priority-IMMEDIATE');
    }

    row.dataset.issueId = issue.id;

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
      '' // last col = actions (pencil)
    ];

    cells.forEach((cellValue, colIndex) => {
      const td = document.createElement('td');

      // widths match headers
      if (tableHeaders[colIndex]) {
        td.style.width = tableHeaders[colIndex].style.width;
      }

      // badges
      if (colIndex === 1) {
        td.innerHTML = `<span class="priority-badge ${issue.priority}">${issue.priority}</span>`;
      } else if (colIndex === 8) {
        td.innerHTML = `<span class="status-badge ${issue.status}">${issue.status}</span>`;
      } else if (colIndex === 2 || colIndex === 3 || colIndex === 9) {
        td.textContent = formatDate(cellValue);
      } else if (colIndex === 11) {
        // --- NEW CODE HERE ---
        // pencil button to open inline editor
        td.innerHTML = `
        <button class="row-edit-btn" data-issue-id="${issue.id}"
                aria-label="Edit row" title="Edit">
            <i class="fa-solid fa-pencil"></i>
        </button>
        `;
        // --- END NEW CODE ---
      } else {
        td.textContent = (cellValue ?? '');
      }

      row.appendChild(td);
    });

    issuesTableBody.appendChild(row);
  });

  // placeholder rows
  const existingRowCount = issues.length;
  if (existingRowCount < DEFAULT_ROWS_TO_RENDER) {
    for (let i = existingRowCount; i < DEFAULT_ROWS_TO_RENDER; i++) {
      const emptyRow = document.createElement('tr');
      for (let j = 0; j < tableHeaders.length; j++) {
        const emptyTd = document.createElement('td');
        if (tableHeaders[j]) {
          emptyTd.style.width = tableHeaders[j].style.width;
        }
        emptyRow.appendChild(emptyTd);
      }
      issuesTableBody.appendChild(emptyRow);
    }
    console.log(`Added ${DEFAULT_ROWS_TO_RENDER - existingRowCount} empty placeholder rows.`);
  }

  if (issues.length === 0 && DEFAULT_ROWS_TO_RENDER === 0) {
    noIssuesMessage.style.display = 'block';
  }

  // --- NEW CODE HERE ---
  // Delegate click for all pencils (bind once)
  if (!issuesTableBody._pencilBound) {
    issuesTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-edit-btn');
      if (!btn) return;
      const id = btn.dataset.issueId;
      if (id) openInlineEditorFor(id);
    });
    issuesTableBody._pencilBound = true;
  }
  // --- END NEW CODE ---
}
