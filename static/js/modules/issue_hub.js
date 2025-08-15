// static/js/modules/issue_hub.js (rewritten for 11-column grid + sorting)
document.addEventListener('DOMContentLoaded', () => {
  // --- state ---
  let currentCategory = 'gameroom';
  let itemsCache = [];
  let sortKey = 'created_at';  // default sort: newest first
  let sortDirection = 'desc';  // 'asc' | 'desc'

  // --- els ---
  const tg = document.getElementById('tab-gameroom');
  const tf = document.getElementById('tab-facility');
  const categoryInput = document.getElementById('categoryInput');
  const statusFilter = document.getElementById('statusFilter');
  const refreshBtn = document.getElementById('refreshBtn');

  const form = document.getElementById('newIssueForm');
  const titleInput = document.getElementById('titleInput');
  const locationInput = document.getElementById('locationInput');
  const priorityInput = document.getElementById('priorityInput');
  const assigneeInput = document.getElementById('assigneeInput');
  const reporterInput = document.getElementById('reporterInput');
  const detailsInput = document.getElementById('detailsInput');
  const issuesBody = document.getElementById('issuesBody');

  // --- helpers ---
  const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };
  const fmtDate = (s) => (s ? s.replace('T',' ').split('.')[0] : '');
  const prettyArea = (c) => (c ? (c === 'gameroom' ? 'Gameroom' : 'Facility') : '');

  function applySort(arr) {
    const d = sortDirection === 'desc' ? -1 : 1;
    return arr.sort((a, b) => {
      let av, bv;

      if (sortKey === 'created_at' || sortKey === 'updated_at' || sortKey === 'target_date') {
        av = a[sortKey] ? new Date(a[sortKey]).getTime() : 0;
        bv = b[sortKey] ? new Date(b[sortKey]).getTime() : 0;
      } else if (sortKey === 'priority') {
        av = PRIORITY_ORDER[(a.priority || 'medium').toLowerCase()] || 0;
        bv = PRIORITY_ORDER[(b.priority || 'medium').toLowerCase()] || 0;
      } else if (sortKey === 'category') {
        av = prettyArea(a.category).toLowerCase();
        bv = prettyArea(b.category).toLowerCase();
      } else {
        av = (a[sortKey] ?? '').toString().toLowerCase();
        bv = (b[sortKey] ?? '').toString().toLowerCase();
      }

      if (av === bv) return 0;
      return d * (av > bv ? 1 : -1);
    });
  }

  function setTab(cat) {
    currentCategory = cat;
    if (categoryInput) categoryInput.value = cat;

    tg?.classList.toggle('active', cat === 'gameroom');
    tf?.classList.toggle('active', cat === 'facility');

    loadList();
  }

  // --- events: tabs/filters/refresh ---
  tg?.addEventListener('click', () => setTab('gameroom'));
  tf?.addEventListener('click', () => setTab('facility'));
  refreshBtn?.addEventListener('click', loadList);
  statusFilter?.addEventListener('change', loadList);

  // --- sorting: header clicks + arrow classes ---
  (function setupHeaderSort() {
    const header = document.querySelector('.issues-grid-header');
    if (!header) return;
    const sortable = header.querySelectorAll('.sortable-header');

    sortable.forEach(h => {
      h.setAttribute('title', 'Do you want to sort?');
      h.setAttribute('aria-label', 'Do you want to sort?');
    });

    function updateHeaderArrows() {
      sortable.forEach(h => h.classList.remove('asc', 'desc'));
      const active = [...sortable].find(h => h.dataset.sort === sortKey);
      if (active) active.classList.add(sortDirection);
    }

    sortable.forEach(h => {
      h.addEventListener('click', () => {
        const key = h.dataset.sort;
        if (sortKey === key) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = key;
          sortDirection = 'asc';
        }
        updateHeaderArrows();
        renderRows(applySort(itemsCache.slice()));
      });
    });

    // set initial arrow
    updateHeaderArrows();
  })();

  // --- fetch + render ---
  async function loadList() {
    const s = statusFilter?.value || 'all';
    let url = `/api/issuehub/list?category=${encodeURIComponent(currentCategory)}`;
    if (s !== 'all') url += `&status=${encodeURIComponent(s)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      itemsCache = data.items || [];
      renderRows(applySort(itemsCache.slice()));
    } catch (err) {
      console.error(err);
      if (issuesBody) {
        issuesBody.innerHTML = `
          <div class="grid-row">
            <div class="grid-cell" style="grid-column: 1 / -1; padding:8px; text-align:center;">Error loading.</div>
          </div>`;
      }
    }
  }

  function renderRows(items) {
    if (!issuesBody) return;

    if (!items.length) {
      issuesBody.innerHTML = `
        <div class="grid-row">
          <div class="grid-cell" style="grid-column: 1 / -1; padding:8px; opacity:.7; text-align:center;">
            No items yet.
          </div>
        </div>`;
      return;
    }

    issuesBody.innerHTML = items.map(it => {
      const issueId   = it.id || '';
      const priority  = (it.priority || '').toString();
      const created   = fmtDate(it.created_at);
      const updated   = fmtDate(it.updated_at);
      const area      = prettyArea(it.category);
      const equip     = it.location || '';
      const problem   = [it.title || '', it.details || ''].filter(Boolean).join(' — ');
      const notes     = it.resolution || '';         // using resolution as Notes for now
      const status    = (it.status || '').replace('_',' ');
      const target    = it.target_date ? fmtDate(it.target_date) : '';
      const assigned  = it.assignee || '';

      const priBadge  = `<span class="badge ${priority.toLowerCase()}">${priority}</span>`;
      const stBadge   = `<span class="badge s-${(it.status || '').toLowerCase()}">${status}</span>`;

      return `
        <div class="grid-row">
          <div class="grid-cell">${issueId}</div>
          <div class="grid-cell">${priBadge}</div>
          <div class="grid-cell">${created}</div>
          <div class="grid-cell">${updated}</div>
          <div class="grid-cell">${area}</div>
          <div class="grid-cell">${equip}</div>
          <div class="grid-cell">${problem}</div>
          <div class="grid-cell">${notes}</div>
          <div class="grid-cell">${stBadge}</div>
          <div class="grid-cell">${target}</div>
          <div class="grid-cell">${assigned}</div>
        </div>
      `;
    }).join('');
  }

  // --- create new issue ---
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      category: categoryInput?.value || currentCategory,
      title: (titleInput?.value || '').trim(),
      details: (detailsInput?.value || '').trim(),
      location: (locationInput?.value || '').trim(),
      priority: priorityInput?.value || 'medium',
      reporter: (reporterInput?.value || '').trim(),
      assignee: (assigneeInput?.value || '').trim()
    };
    if (!payload.title) { alert('Title required'); return; }

    try {
      const res = await fetch('/api/issuehub/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Create failed');
        return;
      }
      // clear + refresh
      if (titleInput) titleInput.value = '';
      if (locationInput) locationInput.value = '';
      if (priorityInput) priorityInput.value = 'medium';
      if (assigneeInput) assigneeInput.value = '';
      if (reporterInput) reporterInput.value = '';
      if (detailsInput) detailsInput.value = '';
      loadList();
    } catch (err) {
      console.error(err);
      alert('Create failed');
    }
  });

  // Keep this for future when you add an Actions column back in.
  async function updateStatus(id, status) {
    try {
      const payload = { id, status };
      if (status === 'resolved') {
        const note = prompt('Resolution note (what fixed it)?');
        if (!note) { alert('Resolution note required.'); return; }
        payload.resolution = note;
      }
      const res = await fetch('/api/issuehub/update_status', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Update failed');
        return;
      }
      loadList();
    } catch (e) {
      console.error(e);
      alert('Update failed');
    }
  }
  // expose if needed globally
  window.updateStatus = updateStatus;

  // initial load
  loadList();
});
