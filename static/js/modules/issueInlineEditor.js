/* --- ENTIRE FILE REPLACEMENT: static/js/modules/issueInlineEditor.js --- */
// Tiny inline editor: double-click a row OR click the pencil to open an editor row.
// Save = PUT /api/issues/<id>, Delete = DELETE /api/issues/<id>, then refresh table.

import { refreshIssuesTableData } from './issuesTable.js';

// simple toast helper
function toast(msg, type = 'Info', ms = 2500) {
  if (window.showToast) window.showToast(msg, type, ms);
  else console.log(`[${type}] ${msg}`);
}

export function initIssueInlineEditor() {
  const table = document.querySelector('.issues-table');
  const tbody = table ? table.querySelector('tbody') : null;
  if (!tbody) {
    console.warn('InlineEditor: tbody not found.');
    return;
  }

  let openEditorRow = null;

  function closeEditor() {
    if (openEditorRow && openEditorRow.parentNode) {
      openEditorRow.parentNode.removeChild(openEditorRow);
      openEditorRow = null;
    }
  }

  function getCellText(row, idx) {
    const td = row.querySelectorAll('td')[idx];
    return td ? td.textContent.trim() : '';
  }

  // --- NEW CODE HERE ---
// Build a <tr> that matches the table (12 cells), with read-only + inputs
function buildEditorRowFor(row, values) {
  const tr = document.createElement('tr');
  tr.className = 'inline-editor-row';

  const makeTd = (cls) => {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    return td;
  };

  const tdReadonly = (text) => {
    const td = makeTd('readonly-cell');
    td.textContent = text || '';
    return td;
  };

  const tdInput = (value, id) => {
    const td = makeTd();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.id = id;
    input.value = value || '';
    td.appendChild(input);
    return td;
  };

  const tdSelect = (options, selected, id) => {
    const td = makeTd();
    const sel = document.createElement('select');
    sel.className = 'cell-select';
    sel.id = id;
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === selected) o.selected = true;
      sel.appendChild(o);
    });
    td.appendChild(sel);
    return td;
  };

  const tdTextarea = (value, id) => {
    const td = makeTd();
    const ta = document.createElement('textarea');
    ta.className = 'cell-textarea';
    ta.id = id;
    ta.rows = 2;
    ta.value = value || '';
    td.appendChild(ta);
    return td;
  };

  const tdDate = (value, id) => {
    const td = makeTd();
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'cell-input';
    input.id = id;
    // normalize to yyyy-mm-dd if longer
    const v = (value || '').slice(0, 10);
    input.value = v;
    td.appendChild(input);
    return td;
  };

  // actions cell (Delete, Save, Cancel) — click handlers are wired later
  const tdActions = () => {
    const td = makeTd('cell-actions');

    const del = document.createElement('button');
    del.type = 'button';
    del.id = 'ie_delete';
    del.className = 'danger-button';
    del.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';

    const save = document.createElement('button');
    save.type = 'button';
    save.id = 'ie_save';
    save.className = 'add-task-button';
    save.textContent = 'Save';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.id = 'ie_cancel';
    cancel.className = 'secondary-button';
    cancel.textContent = 'Cancel';

    td.appendChild(del);
    td.appendChild(save);
    td.appendChild(cancel);
    return td;
  };

  // 12 columns in order: ID, Priority, Date Added, Last Update, Area, Equipment,
  // Description, Notes, Status, Target Date, Assigned, (actions)
  tr.appendChild(tdReadonly(values.id));                                       // 0
  tr.appendChild(tdSelect(['IMMEDIATE','High','Medium','Low','CLEANING'],
                          values.priority, 'ie_priority'));                    // 1
  tr.appendChild(tdReadonly(values.date_added));                               // 2
  tr.appendChild(tdReadonly(values.last_updated));                             // 3
  tr.appendChild(tdInput(values.area, 'ie_area'));                             // 4
  tr.appendChild(tdInput(values.equipment, 'ie_equipment'));                   // 5
  tr.appendChild(tdTextarea(values.description, 'ie_description'));            // 6
  tr.appendChild(tdTextarea(values.notes, 'ie_notes'));                        // 7
  tr.appendChild(tdSelect(['Open','In Progress','Waiting Parts','Resolved'],
                          values.status, 'ie_status'));                        // 8
  tr.appendChild(tdDate(values.target_date, 'ie_target'));                     // 9
  tr.appendChild(tdInput(values.assigned_to, 'ie_assigned'));                  //10
  tr.appendChild(tdActions());                                                 //11

  return tr;
}
// --- END NEW CODE ---

  async function saveIssue(issueId, payload) {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.details || `HTTP ${res.status}`);
      toast('Issue updated', 'Success', 2000);
      refreshIssuesTableData();
      closeEditor();
    } catch (err) {
      console.error(err);
      toast(`Update failed: ${err.message}`, 'Error', 4000);
    }
  }

  // --- NEW CODE HERE ---
  // delete an issue, then refresh table
  async function deleteIssue(issueId) {
    try {
      const res = await fetch(`/api/issues/${issueId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.details || `HTTP ${res.status}`);
      toast('Issue deleted', 'Success', 2000);
      refreshIssuesTableData();
    } catch (err) {
      console.error(err);
      toast(`Delete failed: ${err.message}`, 'Error', 4000);
    }
  }
  // --- END NEW CODE ---

  // open editor under a data row
  // builds the row, copies header widths, wires buttons (save/cancel/delete)
  function openEditorUnder(row) {
    closeEditor(); // only one open at a time

    const issueId = row.dataset.issueId || getCellText(row, 0);
    if (!issueId) return;

    // read current values from the visible row
    const values = {
      id:           issueId,
      priority:     getCellText(row, 1),
      date_added:   getCellText(row, 2),
      last_updated: getCellText(row, 3),
      area:         getCellText(row, 4),
      equipment:    getCellText(row, 5),
      description:  getCellText(row, 6),
      notes:        getCellText(row, 7),
      status:       getCellText(row, 8),
      target_date:  getCellText(row, 9),
      assigned_to:  getCellText(row, 10),
    };

    // build a row that matches the column layout
    const tr = buildEditorRowFor(row, values);

    // copy header widths so cells line up perfectly
    const headers = document.querySelectorAll('.issues-table th');
    Array.from(tr.children).forEach((td, i) => {
      if (headers[i]) td.style.width = headers[i].style.width;
    });

    // insert right after the row being edited
    row.after(tr);
    openEditorRow = tr;

    // wire buttons
    const btnSave   = tr.querySelector('#ie_save');
    const btnCancel = tr.querySelector('#ie_cancel');
    const btnDelete = tr.querySelector('#ie_delete');

    btnCancel.addEventListener('click', closeEditor);

    btnSave.addEventListener('click', () => {
      const payload = {
        equipment_location: tr.querySelector('#ie_equipment').value.trim(),
        area:               tr.querySelector('#ie_area').value.trim(),
        priority:           tr.querySelector('#ie_priority').value,
        status:             tr.querySelector('#ie_status').value,
        description:        tr.querySelector('#ie_description').value.trim(),
        notes:              tr.querySelector('#ie_notes').value.trim(),
        assigned_to:        tr.querySelector('#ie_assigned').value.trim(),
        target_date:        tr.querySelector('#ie_target').value || null
      };
      // Normalize/compat for API expectations
      // Ensure empty string becomes null
      if (payload.target_date === '') payload.target_date = null;

      // Some backends expect camelCase; send both just in case
      payload.targetDate = payload.target_date;

      // Status name compatibility
      if (payload.status === 'Waiting Parts') payload.status = 'Awaiting Parts';
      if (payload.status === 'Resolved') payload.status = 'Closed';

      saveIssue(issueId, payload);
    });

    btnDelete.addEventListener('click', () => {
      const ok = confirm(`Delete issue ${issueId}? This cannot be undone.`);
      if (!ok) return;
      deleteIssue(issueId);
      closeEditor();
    });
  }

  // double-click to edit (only for real rows with an id)
  tbody.addEventListener('dblclick', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const isReal = row.dataset && row.dataset.issueId;
    if (!isReal) return; // ignore placeholder rows
    openEditorUnder(row);
  });

  console.log('Inline editor ready (double-click a row or use the pencil).');
}

// --- NEW CODE HERE ---
// Open the inline editor for a given issue id (used by pencil button)
export function openInlineEditorFor(issueId) {
  // try data-attribute first
  let row = document.querySelector(`.issues-table tbody tr[data-issue-id="${issueId}"]`);
  // fallback: match first cell text
  if (!row) {
    row = Array.from(document.querySelectorAll('.issues-table tbody tr'))
      .find(r => (r.cells?.[0]?.textContent?.trim() === issueId));
  }
  if (!row) {
    console.warn('InlineEditor: row not found for', issueId);
    return;
  }
  row.scrollIntoView({ block: 'nearest' });
  // open editor directly
  const table = document.querySelector('.issues-table');
  if (!table) return;
  // use the same helper
  // find module-scope function via closure:
  // we can't call openEditorUnder from here if it's not exported,
  // so simulate double-click which our init listener handles:
  row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
}
// --- END NEW CODE ---
/* --- END ENTIRE FILE --- */
