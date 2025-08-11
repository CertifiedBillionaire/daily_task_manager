// --- FULL FILE REPLACEMENT START ---
// 3-dot menu: open/close, and quick actions (Edit, Mark Resolved, Assign)
// Uses the backend PUT /api/issues/<id> that you already added.

import { refreshIssuesTableData } from './issuesTable.js';

// small toast helper (fallback to console if not present)
function toast(msg, type = 'Info', ms = 3000) {
  if (window.showToast) window.showToast(msg, type, ms);
  else console.log(`[${type}] ${msg}`);
}

export function initIssueOptions() {
  console.log("initIssueOptions has been called!");

  // scope to the Issues table only
  const tableBody = document.querySelector('.issues-table tbody');
  if (!tableBody) {
    console.warn('Issue options: tbody not found.');
    return;
  }

  // Event delegation on tbody
  tableBody.addEventListener('click', (event) => {
    const button   = event.target.closest('.issue-options-button');
    const menuItem = event.target.closest('.menu-item');

    // Toggle menu when clicking the 3-dot button
    if (button) {
      const menu = button.nextElementSibling;

      // Close other open menus
      document.querySelectorAll('.issue-options-menu:not(.hidden)').forEach((open) => {
        if (open !== menu) open.classList.add('hidden');
      });

      // Toggle this one
      menu?.classList.toggle('hidden');
      return;
    }

    // Handle menu item clicks
    if (menuItem) {
      const action = menuItem.dataset.action;
      const row    = menuItem.closest('tr');

      // Prefer data-attribute from renderer; fallback to first cell
      const issueId =
        row?.dataset.issueId ||
        row?.querySelector('td:first-child')?.textContent?.trim();

      if (!issueId) {
        toast('Could not find issue id for this row', 'Error', 4000);
        return;
      }

      handleMenuAction(action, issueId, row);

      // Hide the menu after selecting
      menuItem.closest('.issue-options-menu')?.classList.add('hidden');
      return;
    }

    // Clicked elsewhere in the table → close any open menus
    document.querySelectorAll('.issue-options-menu:not(.hidden)').forEach((open) => {
      open.classList.add('hidden');
    });
  });

  // Click outside the table → close any open menus
  document.addEventListener('click', (event) => {
    const isInside = tableBody.contains(event.target);
    if (!isInside) {
      document.querySelectorAll('.issue-options-menu:not(.hidden)').forEach((menu) => {
        menu.classList.add('hidden');
      });
    }
  });
}

// -------- helpers --------

// Read plain text from a specific cell index in a row
function getCellText(row, index) {
  const td = row?.querySelectorAll('td')?.[index];
  return td ? td.textContent.trim() : '';
}

// PUT update to backend, then refresh table
async function updateIssueFields(issueId, fields, okMsg = 'Issue updated') {
  try {
    const res = await fetch(`/api/issues/${issueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || data?.details || `HTTP ${res.status}`);
    }

    toast(okMsg, 'Success', 2500);
    refreshIssuesTableData();
  } catch (err) {
    toast(`Update failed: ${err.message}`, 'Error', 5000);
    console.error('Update error:', err);
  }
}

// Quick edit via simple prompts (fastest way to get editing today)
async function quickEditIssue(issueId, row) {
  // current values from the row
  const current = {
    description: getCellText(row, 6), // Problem Description
    priority:    getCellText(row, 1), // Priority
    notes:       getCellText(row, 7), // Notes
  };

  // three small prompts; cancel = keep as-is
  const pDesc = prompt('Edit Description (leave blank to keep):', current.description);
  const pPrio = prompt('Edit Priority (IMMEDIATE, High, Medium, Low, CLEANING) — leave blank to keep:', current.priority);
  const pNote = prompt('Edit Notes (leave blank to keep):', current.notes);

  const payload = {};

  if (pDesc !== null) {
    const v = (pDesc || '').trim();
    if (v && v !== current.description) payload.description = v;
  }
  if (pPrio !== null) {
    const v = (pPrio || '').trim();
    if (v && v !== current.priority) payload.priority = v;
  }
  if (pNote !== null) {
    const v = (pNote || '').trim();
    if (v !== current.notes) payload.notes = v; // allow clearing notes
  }

  if (Object.keys(payload).length === 0) {
    toast('No changes to save.', 'Info', 2000);
    return;
  }

  await updateIssueFields(issueId, payload, 'Issue updated');
}

// -------- menu actions --------
function handleMenuAction(action, issueId, row) {
  switch (action) {
    case 'edit':
      quickEditIssue(issueId, row);
      break;

    case 'mark-resolved':
      updateIssueFields(issueId, { status: 'Resolved' }, 'Marked as Resolved');
      break;

    case 'assign-employee': {
      const currentAssigned = getCellText(row, 10); // Assigned Employee
      const name = prompt('Assign to (enter name, blank to cancel):', currentAssigned);
      if (name === null) return; // cancel
      const v = name.trim();
      if (!v) {
        toast('Assignment canceled.', 'Info', 2000);
        return;
      }
      updateIssueFields(issueId, { assigned_to: v }, 'Assignee updated');
      break;
    }

    case 'delete':
      // You don’t have a DELETE route yet; keep this as a friendly message.
      toast('Delete not enabled yet. We can add it next!', 'Info', 3500);
      break;
  }
}
// --- FULL FILE REPLACEMENT END ---
