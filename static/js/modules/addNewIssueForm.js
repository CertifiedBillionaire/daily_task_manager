// =========================================================================
// ARCADE MANAGER - ADD NEW ISSUE FORM MODULE
// Handles the collapsible behavior + submit logic for "New Issue" form
// =========================================================================

import { refreshIssuesTableData } from './issuesTable.js';

// --- helpers --------------------------------------------------------------

// Pull recent equipment/game names for the datalist
async function fetchEquipmentLocations() {
  try {
    const res = await fetch('/api/equipment_locations');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    console.warn('Could not load equipment locations:', e);
    return [];
  }
}

// Fill <datalist id="games-list"> with unique items
function fillEquipmentLocationDatalist(items) {
  const list = document.getElementById('games-list'); // matches your HTML
  if (!list) return;

  const seen = new Set();
  const unique = [];
  for (const raw of items) {
    if (!raw) continue;
    const key = String(raw).trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(raw); // newest-first assumed from API
    }
  }

  list.innerHTML = '';
  unique.forEach((val) => {
    const opt = document.createElement('option');
    opt.value = String(val);
    list.appendChild(opt);
  });
}

// Simple collapsible
function setupCollapsible(headerId, contentClass) {
  const header = document.getElementById(headerId);
  if (!header) {
    console.warn(`Collapsible: header #${headerId} not found`);
    return;
  }
  const content = header.nextElementSibling; // your .collapsible-content after header
  if (!content || !content.classList.contains(contentClass)) {
    console.warn(`Collapsible: content .${contentClass} not found after #${headerId}`);
    return;
  }
  header.addEventListener('click', () => {
    header.classList.toggle('active');
    content.classList.toggle('active');
  });
}

// --- main ----------------------------------------------------------------

export function initAddNewIssueForm() {
  // match your HTML ids/classes
  setupCollapsible('newIssueToggle', 'collapsible-content');
  fetchEquipmentLocations().then(fillEquipmentLocationDatalist);

  // form + inputs (match your template IDs exactly)
  const form               = document.getElementById('newIssueForm');
  const descriptionInput   = document.getElementById('problemDescriptionInput');
  const equipmentInput     = document.getElementById('equipmentNameInput');
  const categoryInput      = document.getElementById('categoryInput');       // hidden input
  const priorityInput      = document.getElementById('priorityInput');
  const statusInput        = document.getElementById('newStatusInput');
  const assignedInput      = document.getElementById('assignedEmployeeInput');
  const targetDateInput    = document.getElementById('targetDateInput');
  const notesInput         = document.getElementById('notesInput');

  if (!form) {
    console.warn('Add New Issue Form: #newIssueForm not found.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Build payload with KEYS the backend expects (see issues_api.py)
    const issueData = {
      title:       (descriptionInput?.value || '').trim(),
      priority:     priorityInput?.value || 'medium',
      status:       statusInput?.value || 'open',
      category:     categoryInput?.value || 'gameroom',
      location:    (equipmentInput?.value || '').trim(),
      notes:       (notesInput?.value || '').trim(),
      target_date:  targetDateInput?.value || null,
      assignee:    (assignedInput?.value || '').trim(),
    };

    // Minimal validation (add more if you want)
    if (!issueData.title || !issueData.priority || !issueData.status) {
      window.showToast('Need: Problem Description, Priority, and Status.', 'Error', 5000);
      return;
    }

    // Optional smart rules by category (frontend only)
    if (issueData.category === 'Safety') {
      issueData.priority = 'IMMEDIATE';
    } else if (issueData.category === 'Cleaning') {
      issueData.priority = 'CLEANING';
    }

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const out = await res.json();
      window.showToast(`Issue ${out.issue_id} added!`, 'Success', 3000);

      // reset form
      form.reset();

      // refresh table + datalist so you see it instantly
      await refreshIssuesTableData();
      fetchEquipmentLocations().then(fillEquipmentLocationDatalist);
    } catch (err) {
      console.error('Add issue failed:', err);
      window.showToast(`Error adding issue: ${err.message}`, 'Error', 5000);
    }
  });
}
