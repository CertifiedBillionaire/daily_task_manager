// --- FULL FILE REWRITE START ---
// =========================================================================
// ARCADE MANAGER - TABLE COLUMN MANAGER MODULE
// Handles: toolbar toggle, column select/deselect, align buttons,
// and alignment PERSISTENCE across refresh + re-render.
// =========================================================================

export function initTableColumnManager() {
  const table = document.querySelector('.issues-table');
  const headers = table ? table.querySelectorAll('thead th') : [];
  const issuesToolbarToggle  = document.getElementById('issuesToolbarToggle');   // chevron
  const issuesToolbarCompact = document.getElementById('issuesToolbarCompact');  // toolbar box

  if (!table || headers.length === 0 || !issuesToolbarToggle || !issuesToolbarCompact) {
    console.warn("Table Column Manager: missing table/headers/toolbar parts.");
    return;
  }

  // --- NEW CODE HERE ---
  // 1) Toolbar chevron open/close
  issuesToolbarToggle.addEventListener('click', () => {
    issuesToolbarCompact.classList.toggle('active');
  });
  // --- END NEW CODE ---

  // --- NEW CODE HERE ---
  // 2) Column selection (click header to select)
  let activeColIndex = -1;

  function clearColumnSelection() {
    headers.forEach(h => h.classList.remove('col-selected'));
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      row.querySelectorAll('td').forEach(td => td.classList.remove('col-selected'));
    });
  }

  function applyColumnSelection(colIndex) {
    if (colIndex < 0) return;
    headers[colIndex]?.classList.add('col-selected');
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const tds = row.querySelectorAll('td');
      if (tds[colIndex]) tds[colIndex].classList.add('col-selected');
    });
  }

  headers.forEach((th, idx) => {
    th.addEventListener('click', () => {
      activeColIndex = idx;
      clearColumnSelection();
      applyColumnSelection(idx);
      console.log('Active column:', idx);
    });
  });

  // Deselect when clicking outside table AND outside toolbar
  document.addEventListener('click', (event) => {
    const clickInsideTable   = table.contains(event.target);
    const clickInsideToolbar = issuesToolbarCompact.contains(event.target);
    if (!clickInsideTable && !clickInsideToolbar) {
      activeColIndex = -1;
      clearColumnSelection();
    }
  });
  // --- END NEW CODE ---

  // --- NEW CODE HERE ---
  // 3) Alignment: save & load per column
  const ALIGN_STORAGE_KEY = 'issuesTableAlign';

  function loadAlignPrefs() {
    try { return JSON.parse(localStorage.getItem(ALIGN_STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveAlignPrefs(prefs) {
    localStorage.setItem(ALIGN_STORAGE_KEY, JSON.stringify(prefs));
  }

  // Apply alignment to one column (header + cells)
  function applyAlignmentToColumn(colIndex, align) {
    if (colIndex < 0) return;
    if (headers[colIndex]) headers[colIndex].style.textAlign = align;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const tds = row.querySelectorAll('td');
      if (tds[colIndex]) tds[colIndex].style.textAlign = align;
    });
  }

  // Apply all saved alignments (used on load and after re-render)
  function applyAllAlignments() {
    const prefs = alignPrefs; // current in-memory copy
    Object.entries(prefs).forEach(([k, align]) => {
      const idx = parseInt(k, 10);
      if (!Number.isNaN(idx)) applyAlignmentToColumn(idx, align);
    });
  }

  // In-memory copy
  let alignPrefs = loadAlignPrefs();
  // Apply saved alignments now (headers + any existing rows)
  applyAllAlignments();

  // Align buttons -> set + save
  function setColumnAlignment(colIndex, align) {
    if (colIndex < 0) {
      console.log('Pick a column first.');
      return;
    }
    applyAlignmentToColumn(colIndex, align);
    alignPrefs[colIndex] = align;
    saveAlignPrefs(alignPrefs);
  }

  // Hook up the three toolbar buttons
  const btnAlignLeft   = document.querySelector('.toolbar-button[data-action="align-left"]');
  const btnAlignCenter = document.querySelector('.toolbar-button[data-action="align-center"]');
  const btnAlignRight  = document.querySelector('.toolbar-button[data-action="align-right"]');

  btnAlignLeft   && btnAlignLeft.addEventListener('click',   () => setColumnAlignment(activeColIndex, 'left'));
  btnAlignCenter && btnAlignCenter.addEventListener('click', () => setColumnAlignment(activeColIndex, 'center'));
  btnAlignRight  && btnAlignRight.addEventListener('click',  () => setColumnAlignment(activeColIndex, 'right'));
  // --- END NEW CODE ---

  // --- NEW CODE HERE ---
  // 4) Re-apply alignment when the body changes (table re-renders)
  const tbody = table.querySelector('tbody');
  if (tbody) {
    let applyScheduled = null;
    const scheduleApply = () => {
      if (applyScheduled) return;
      applyScheduled = requestAnimationFrame(() => {
        applyScheduled = null;
        applyAllAlignments();
        // keep selection highlight accurate after re-render
        clearColumnSelection();
        applyColumnSelection(activeColIndex);
      });
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(tbody, { childList: true, subtree: true });
  }
  // --- END NEW CODE ---

  console.log('Table Column Manager initialized (toggle, select, align + persistence).');
}
// --- FULL FILE REWRITE END ---
