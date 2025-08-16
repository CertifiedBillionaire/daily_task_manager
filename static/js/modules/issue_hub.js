document.addEventListener('DOMContentLoaded', () => {

  // Pick up a suggested filter from notifications
  const launchFilter = localStorage.getItem('issuehub.launch.filter');
  if (launchFilter && document.getElementById('statusFilter')) {
    document.getElementById('statusFilter').value = launchFilter;
    localStorage.removeItem('issuehub.launch.filter');
  }
    // focus a specific row if ?focus=IH### is present
  const _params = new URLSearchParams(location.search);
  let _pendingFocusId = _params.get('focus');
  if (_pendingFocusId) {
    // clean the URL so refreshes don't re-focus
    history.replaceState(null, '', location.pathname);
  }
  // =========================
  // state
  // =========================
  let currentCategory = 'gameroom';
  let itemsCache = [];
  let sortKey = 'created_at';
  let sortDirection = 'desc';
  let currentStatus = 'all'; // open | in_progress | resolved | archived | trash | all
  let editingId = null;      // current inline-edit row id

  // =========================
  // els
  // =========================
  const tg = document.getElementById('tab-gameroom');
  const tf = document.getElementById('tab-facility');
  const t_games = document.getElementById('tab-games');

  const categoryInput   = document.getElementById('categoryInput');
  const statusFilter    = document.getElementById('statusFilter');
  const refreshBtn      = document.getElementById('refreshBtn');

  // Games tab controls (optional row)
  const gamesFilterWrap  = document.getElementById('gamesFilter');
  const gamesFilterInput = document.getElementById('gamesFilterInput');
  const gamesFilterGo    = document.getElementById('gamesFilterGo');

  const issuesBody              = document.getElementById('issuesBody');

  // Notes modal (must exist in HTML)
  const noteModal      = document.getElementById('noteModal');
  const noteModalBody  = document.getElementById('noteModalBody');
  const noteModalClose = document.getElementById('noteModalClose');

  // =========================
  // helpers
  // =========================
  function escapeHtml(s = '') {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }
  function decodeEntities(s) { // for notes modal
    const el = document.createElement('textarea');
    el.innerHTML = s || '';
    return el.value;
  }
  function toast(msg, type = 'Info', ms = 2000) {
    if (window.showToast) window.showToast(msg, type, ms);
    else console.log(`${type}: ${msg}`);
  }

  const formatIssueId = (id) => (typeof id !== 'number' ? id : `IH-${String(id).padStart(3,'0')}`);
  const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };
  const formatDateTime = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return new Intl.DateTimeFormat('en-US', { year:'numeric', month:'short', day:'numeric' }).format(d);
  };
  const prettyArea = (c) => (c ? (c === 'gameroom' ? 'Gameroom' : 'Facility') : '');

  function applySort(arr) {
    const d = sortDirection === 'desc' ? -1 : 1;
    return arr.sort((a, b) => {
      let av, bv;
      if (['created_at','updated_at','target_date'].includes(sortKey)) {
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

  // =========================
  // Inline-edit builders
  // =========================
  function buildPrioritySelect(val) {
    const v = (val || 'medium').toLowerCase();
    return `
      <select class="ie-priority">
        <option value="low" ${v==='low'?'selected':''}>low</option>
        <option value="medium" ${v==='medium'?'selected':''}>medium</option>
        <option value="high" ${v==='high'?'selected':''}>high</option>
      </select>
    `;
  }
  function buildTextInput(val, cls='') {
    return `<input type="text" class="${cls}" value="${escapeHtml(val||'')}" />`;
  }
  function buildTextarea(val) {
    return `<textarea class="ie-notes" rows="2">${escapeHtml(val||'')}</textarea>`;
  }
  function buildLocationInput(val) {
    if (currentCategory === 'gameroom') {
      return `<input type="text" class="ie-location" list="games-list" value="${escapeHtml(val||'')}" placeholder="Select or type a game" />`;
    }
    return buildTextInput(val, 'ie-location');
  }
  async function buildAssigneeSelect(current) {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const opts = ['<option value="">— Unassigned —</option>']
        .concat(items.map(e => `<option value="${escapeHtml(e.name)}"${(e.name===current)?' selected':''}>${escapeHtml(e.name)}</option>`));
      return `<select class="ie-assignee">${opts.join('')}</select>`;
    } catch {
      return buildTextInput(current, 'ie-assignee-fallback');
    }
  }

  async function enterEditMode(row) {
    const id = row?.dataset?.id;
    if (!id) return;
    if (editingId && editingId !== id) {
      toast('Finish current edit first.', 'Info', 1800);
      return;
    }
    editingId = id;
    if (currentCategory === 'gameroom') await fetchAndPopulateGames();
    row.setAttribute('data-editing', '1');

    const cPriority  = row.querySelector('[data-field="priority"]');
    const cLocation  = row.querySelector('[data-field="location"]');
    const cTitle     = row.querySelector('[data-field="title"]');
    const cNotesCell = row.querySelector('[data-field="details"]');
    const cAssignee  = row.querySelector('[data-field="assignee"]');
    const cActions   = row.querySelector('.cell-actions');

    const currentPriority = (row.querySelector('[data-field="priority"] .badge')?.textContent || 'medium').trim().toLowerCase();

    const currentLocation = cLocation?.textContent?.trim() || '';
    const currentTitle    = cTitle?.textContent?.trim() || '';
    const currentNotesEsc = cNotesCell?.dataset?.note || '';
    const currentNotes    = decodeEntities(currentNotesEsc);
    const currentAssignee = cAssignee?.textContent?.trim() || '';

    if (cPriority)  cPriority.innerHTML  = buildPrioritySelect(currentPriority);
    if (cLocation)  cLocation.innerHTML  = buildLocationInput(currentLocation);
    if (cTitle)     cTitle.innerHTML     = buildTextInput(currentTitle, 'ie-title');
    if (cNotesCell) cNotesCell.innerHTML = buildTextarea(currentNotes);
    if (cAssignee)  cAssignee.innerHTML  = await buildAssigneeSelect(currentAssignee);

    if (cActions) {
      cActions.innerHTML = `
        <div class="row-actions">
          <button class="action-chip is-save"   data-action="saveedit"   data-id="${id}"><i class="fas fa-save"></i><span>Save</span></button>
          <button class="action-chip is-cancel" data-action="canceledit" data-id="${id}"><i class="fas fa-times"></i><span>Cancel</span></button>
        </div>
      `;
    }
  }

  async function updateFields(id, fields) {
    const res = await fetch('/api/issuehub/update_fields', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id, ...fields })
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Update failed');
    return data;
  }

  // =========================
  // Employees + Games
  // =========================
  async function populateEmployees() {
    const sel = document.getElementById('assignedEmployeeInput');
    if (!sel) return;
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      sel.innerHTML = '<option value="">— Unassigned —</option>' +
        items.map(e => `<option value="${escapeHtml(e.name)}">${escapeHtml(e.name)}</option>`).join('');
    } catch (e) {
      console.error('employees fetch failed', e);
    }
    try {
      const last = localStorage.getItem('last_assignee');
      if (last && sel.querySelector(`option[value="${CSS.escape(last)}"]`)) {
        sel.value = last;
      }
    } catch {}
  }

 async function fetchAndPopulateGames() {
   const dl = document.getElementById('games-list');
   if (!dl) return;
   try {
     const res = await fetch('/api/games');
     const data = await res.json();
     dl.innerHTML = '';
     (data || []).forEach(game => {
       const option = document.createElement('option');
       option.value = game.name;
       dl.appendChild(option);
     });
   } catch (err) {
     console.error('Error fetching game list:', err);
   }
 }

  function setTab(cat) {
    currentCategory = cat;
    if (categoryInput) categoryInput.value = cat;

    tg?.classList.toggle('active', cat === 'gameroom');
    tf?.classList.toggle('active', cat === 'facility');
    t_games?.classList.toggle('active', cat === 'games');

    if (gamesFilterWrap) gamesFilterWrap.style.display = (cat === 'games') ? 'flex' : 'none';
    // ⬇️ clear the Games filter when switching away
    if (cat !== 'games' && gamesFilterInput) gamesFilterInput.value = '';

    if (cat === 'gameroom' || cat === 'games') {
      fetchAndPopulateGames();
    } else {
      const dl = document.getElementById('games-list');
      if (dl) dl.innerHTML = '';
    }

    loadList();
  }

  // --- init from URL (?tab=gameroom|facility|games) ---
  function initFromURL() {
    const sp = new URLSearchParams(location.search);
    const urlTab = sp.get('tab'); // 'gameroom' | 'facility' | 'games'

    if (['gameroom','facility','games'].includes(urlTab)) {
      setTab(urlTab);           // setTab() already calls loadList()
    } else {

      initFromURL();
 
      loadList();
    }

    // keep your current behavior
    populateEmployees();
  }



  tg?.addEventListener('click', () => setTab('gameroom'));
  tf?.addEventListener('click', () => setTab('facility'));
  t_games?.addEventListener('click', () => setTab('games'));
  refreshBtn?.addEventListener('click', loadList);
  statusFilter?.addEventListener('change', loadList);
  gamesFilterGo?.addEventListener('click', loadList);
  gamesFilterInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); loadList(); }
  });

  // sort header UI
  (function setupHeaderSort() {
    const header = document.querySelector('.issues-grid-header');
    if (!header) return;
    const sortable = header.querySelectorAll('.sortable-header');
    function updateHeaderArrows() {
      sortable.forEach(h => h.classList.remove('asc', 'desc'));
      const active = [...sortable].find(h => h.dataset.sort === sortKey);
      if (active) active.classList.add(sortDirection);
    }
    sortable.forEach(h => {
      h.title = 'Do you want to sort?';
      h.setAttribute('aria-label', 'Do you want to sort?');
      h.addEventListener('click', () => {
        const key = h.dataset.sort;
        if (sortKey === key) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDirection = 'asc'; }
        updateHeaderArrows();
        renderRows(applySort(itemsCache.slice()));
        focusRowFromURL();

      });
    });
    updateHeaderArrows();
  })();

  // =========================
  // data load + render
  // =========================
  async function loadList() {
    const s = statusFilter?.value || 'all';
    currentStatus = s;

    let url;
    if (currentCategory === 'games') {
      const gameName = (gamesFilterInput?.value || '').trim();
      if (!gameName) {
        if (issuesBody) {
          issuesBody.innerHTML = `
            <div class="grid-row">
              <div class="grid-cell" style="grid-column: 1 / -1; padding:8px; opacity:.7; text-align:center;">
                Pick a game above to see all its issues.
              </div>
            </div>`;
        }
        return;
      }
      const qp = new URLSearchParams({ location: gameName, status: s });
      url = `/api/issuehub/by_game?${qp.toString()}`;
    } else {
      url = `/api/issuehub/list?category=${encodeURIComponent(currentCategory)}&status=${encodeURIComponent(s)}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      itemsCache = data.items || [];
      renderRows(applySort(itemsCache.slice()));

      // 🔎 If we were asked to focus a specific issue, flash & scroll to it
      if (_pendingFocusId) {
        const row = document.querySelector(`.grid-row[data-id="${CSS.escape(_pendingFocusId)}"]`);
        if (row && typeof viewExistingIssue === 'function') {
          await viewExistingIssue(_pendingFocusId);
        }
        _pendingFocusId = null;
      }
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

    const inTrashView = (currentStatus === 'trash');

    issuesBody.innerHTML = items.map(it => {
      const priority = (it.priority || '').toString();
      const created  = formatDateTime(it.created_at);
      const updated  = formatDateTime(it.updated_at);
      const area     = prettyArea(it.category);
      const equip    = escapeHtml(it.location || '');
      const problem  = escapeHtml(it.title || '');
      const target   = it.target_date ? formatDateTime(it.target_date) : '';
      const assigned = escapeHtml(it.assignee || '');
      const statusRaw     = (it.status || '').toLowerCase();
      const statusDisplay = (it.status || '').replace(/_/g, ' ');
      const priBadge = `<span class="badge ${priority.toLowerCase()}">${escapeHtml(priority)}</span>`;
      const stBadge  = `<span class="badge s-${statusRaw}">${escapeHtml(statusDisplay)}</span>`;

      const rawNotes = (it.notes ?? it.details ?? '') + '';
      const notesEsc = escapeHtml(rawNotes);

      let actions = '';
      if (inTrashView) {
        actions = `
          <div class="row-actions">
            <button class="action-chip is-restore"        data-action="restore"        data-id="${it.id}"><i class="fas fa-undo"></i><span>Restore</span></button>
            <button class="action-chip is-delete-forever" data-action="delete_forever" data-id="${it.id}"><i class="fas fa-trash"></i><span>Delete Forever</span></button>
          </div>`;
      } else if (statusRaw === 'open') {
        actions = `
          <div class="row-actions">
            <button class="action-chip"             data-action="edit"    data-id="${it.id}"><i class="fas fa-edit"></i><span>Edit</span></button>
            <button class="action-chip is-start"    data-action="start"   data-id="${it.id}"><i class="fas fa-play"></i><span>Start</span></button>
            <button class="action-chip is-resolve"  data-action="resolve" data-id="${it.id}"><i class="fas fa-check"></i><span>Resolve</span></button>
            <button class="action-chip is-archive"  data-action="archive" data-id="${it.id}"><i class="fas fa-archive"></i><span>Archive</span></button>
            <button class="action-chip is-delete"   data-action="trash"   data-id="${it.id}"><i class="fas fa-trash"></i><span>Trash</span></button>
          </div>`;
      } else if (statusRaw === 'in_progress') {
        actions = `
          <div class="row-actions">
            <button class="action-chip"             data-action="edit"    data-id="${it.id}"><i class="fas fa-edit"></i><span>Edit</span></button>
            <button class="action-chip is-resolve"  data-action="resolve" data-id="${it.id}"><i class="fas fa-check"></i><span>Resolve</span></button>
            <button class="action-chip is-reopen"   data-action="reopen"  data-id="${it.id}"><i class="fas fa-undo"></i><span>Reopen</span></button>
            <button class="action-chip is-archive"  data-action="archive" data-id="${it.id}"><i class="fas fa-archive"></i><span>Archive</span></button>
            <button class="action-chip is-delete"   data-action="trash"   data-id="${it.id}"><i class="fas fa-trash"></i><span>Trash</span></button>
          </div>`;
      } else if (statusRaw === 'resolved') {
        actions = `
          <div class="row-actions">
            <button class="action-chip"             data-action="edit"    data-id="${it.id}"><i class="fas fa-edit"></i><span>Edit</span></button>
            <button class="action-chip is-reopen"   data-action="reopen"  data-id="${it.id}"><i class="fas fa-undo"></i><span>Reopen</span></button>
            <button class="action-chip is-archive"  data-action="archive" data-id="${it.id}"><i class="fas fa-archive"></i><span>Archive</span></button>
            <button class="action-chip is-delete"   data-action="trash"   data-id="${it.id}"><i class="fas fa-trash"></i><span>Trash</span></button>
          </div>`;
      } else { // archived
        actions = `
          <div class="row-actions">
            <button class="action-chip"              data-action="edit"        data-id="${it.id}"><i class="fas fa-edit"></i><span>Edit</span></button>
            <button class="action-chip is-unarchive" data-action="unarchive"   data-id="${it.id}"><i class="fas fa-box-open"></i><span>Unarchive</span></button>
            <button class="action-chip is-delete"    data-action="trash"       data-id="${it.id}"><i class="fas fa-trash"></i><span>Trash</span></button>
          </div>`;
      }

      const formattedId = formatIssueId(it.id);

      return `
        <div class="grid-row" data-id="${it.id}">
          <div class="grid-cell cell-issue-id">${escapeHtml(formattedId)}</div>
          <div class="grid-cell" data-field="priority">${priBadge}</div>
          <div class="grid-cell">${created}</div>
          <div class="grid-cell">${updated}</div>
          <div class="grid-cell">${escapeHtml(area)}</div>
          <div class="grid-cell" data-field="location">${equip}</div>
          <div class="grid-cell" data-field="title">${problem}</div>
          <div class="grid-cell cell-notes" data-field="details" title="${notesEsc}" data-note="${notesEsc}">
            <span class="note-preview">${notesEsc}</span>
            <button class="note-view-btn" type="button" aria-label="View full note">View</button>
          </div>
          <div class="grid-cell">${stBadge}</div>
          <div class="grid-cell">${target}</div>
          <div class="grid-cell" data-field="assignee">${assigned}</div>
          <div class="grid-cell cell-actions">${actions}</div>
        </div>
      `;
    }).join('');
  }
  // --- Focus support: /issuehub?focus=IH-### or plain number ---
  function focusRowFromURL() {
    const params = new URLSearchParams(location.search);
    const focus = params.get('focus');
    if (!focus) return;

    // try to match by numeric id against data-id on the row
    const numeric = focus.replace(/\D/g,'');
    let row = numeric
      ? issuesBody?.querySelector(`.grid-row[data-id="${CSS.escape(numeric)}"]`)
      : null;

    // fallback: match by the visible "Issue ID" cell text (IH-### or IH###)
    if (!row && issuesBody) {
      const want = focus.toUpperCase().replace(/[^A-Z0-9-]/g,'');
      row = [...issuesBody.querySelectorAll('.grid-row')].find(r => {
        const text = (r.querySelector('.cell-issue-id')?.textContent || '')
                      .toUpperCase().replace(/\s+/g,'');
        return text.includes(want) || text.replace('-','') === want.replace('-','');
      }) || null;
    }

    if (!row) return;
    // reuse your existing flash CSS helper if present
    if (typeof ensureFlashCSS === "function") ensureFlashCSS();
    row.classList.add('row-flash');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => row.classList.remove('row-flash'), 1500);

    // clear the param so it won't re-trigger on refresh
    const url = new URL(location.href);
    url.searchParams.delete('focus');
    history.replaceState(null, '', url.toString());
  }

  // --- duplicate UX helpers (flash row + tiny modal) ---
  function ensureFlashCSS() {
    if (document.getElementById('row-flash-style')) return;
    const st = document.createElement('style');
    st.id = 'row-flash-style';
    st.textContent = `
      .row-flash { outline: 2px solid #ffcc00; animation: rf 1.2s ease-in-out 1; }
      @keyframes rf { 0%{background:#fff9cc;} 50%{background:#fff0a6;} 100%{background:transparent;} }
      .mini-modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index:9999; }
      .mini-modal { background:#fff; width:min(520px, 92vw); border-radius:12px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.25); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; }
      .mini-modal h4 { margin:0 0 8px; font-size:18px; }
      .mini-modal p { margin:0 0 12px; opacity:.85; }
      .mini-actions { display:flex; gap:8px; justify-content:flex-end; }
      .mini-actions button { border:0; padding:8px 12px; border-radius:8px; cursor:pointer; }
      .mini-actions .view { background:#e5e7eb; }
      .mini-actions .add { background:#16a34a; color:#fff; }
      .mini-actions .cancel { background:#ef4444; color:#fff; }
    `;
    document.head.appendChild(st);
  }

  async function viewExistingIssue(existingId) {
    ensureFlashCSS();
    if (typeof loadList === 'function') {
      if (statusFilter) statusFilter.value = 'all';
      await loadList();
    }
    const row = issuesBody?.querySelector(`.grid-row[data-id="${CSS.escape(existingId)}"]`);
    if (!row) { toast('Issue exists but not visible in this view.', 'Info', 2000); return; }
    row.classList.add('row-flash');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => row.classList.remove('row-flash'), 1500);

    const cell = row.querySelector('.cell-notes');
    const escaped = cell?.dataset.note || '';
    const full = decodeEntities(escaped);
    if (full) openNoteModal(full);
  }


  // =========================
  // actions (chips)
  // =========================
  async function performAction(id, action) {
    // Trash
    if (action === 'trash') {
      const res = await fetch('/api/issuehub/trash', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || 'Move to Trash failed');
      loadList(); return;
    }
    // Restore
    if (action === 'restore') {
      const res = await fetch('/api/issuehub/restore', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      loadList(); return;
    }
    // Delete forever
    if (action === 'delete_forever') {
      const res = await fetch('/api/issuehub/delete', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      loadList(); return;
    }

    // Status changes
    let payload = { id };
    if (action === 'start')        payload.status = 'in_progress';
    else if (action === 'resolve') {
      payload.status = 'resolved';
      const note = prompt('Resolution note (what fixed it)?');
      if (!note) { throw new Error('Resolution note required.'); }
      payload.resolution = note;
    }
    else if (action === 'reopen')    payload.status = 'open';
    else if (action === 'archive')   payload.status = 'archived';
    else if (action === 'unarchive') payload.status = 'open';
    else return;

    const res = await fetch('/api/issuehub/update_status', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Update failed');
    loadList();
  }

  issuesBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.action-chip');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    // Inline edit
    if (action === 'edit') {
      await enterEditMode(btn.closest('.grid-row'));
      return;
    }
    if (action === 'canceledit') {
      editingId = null;
      loadList();
      return;
    }
    if (action === 'saveedit') {
      const row = btn.closest('.grid-row');
      const pri = row.querySelector('.ie-priority')?.value || undefined;
      const loc = row.querySelector('.ie-location')?.value?.trim();
      const ttl = row.querySelector('.ie-title')?.value?.trim();
      const nts = row.querySelector('.ie-notes')?.value?.trim();
      let asg   = row.querySelector('.ie-assignee')?.value;
      if (asg == null) asg = row.querySelector('.ie-assignee-fallback')?.value;

      const payload = {};
      if (pri)        payload.priority  = pri;
      if (loc != null) payload.location = loc;
      if (ttl != null) payload.title    = ttl;
      if (nts != null) payload.notes    = nts;
      if (asg != null) payload.assignee = asg;

      btn.disabled = true; btn.classList.add('is-loading');
      try {
        await updateFields(id, payload);
        editingId = null;
        toast('Issue updated', 'Success', 1800);
        loadList();
      } catch (err) {
        toast(err.message || 'Update failed', 'Error', 2200);
      } finally {
        btn.classList.remove('is-loading'); btn.disabled = false;
      }
      return;
    }

    // confirmations (destructive)
    const confirms = {
      archive:        'Archive this issue?',
      unarchive:      'Unarchive this issue?',
      trash:          'Move this issue to Trash?',
      delete_forever: 'Delete forever? This cannot be undone.'
    };
    if (confirms[action] && !confirm(confirms[action])) return;

    // normal chip actions
    btn.disabled = true; btn.classList.add('is-loading');
    try {
      await performAction(id, action);
      const msgMap = {
        start: 'Moved to In Progress',
        resolve: 'Resolved',
        reopen: 'Reopened',
        archive: 'Archived',
        unarchive: 'Unarchived',
        trash: 'Moved to Trash',
        restore: 'Restored',
        delete_forever: 'Deleted forever'
      };
      toast(msgMap[action] || 'Updated', 'Success', 1500);
    } catch (e2) {
      toast(e2.message || 'Action failed', 'Error', 2000);
    } finally {
      btn.classList.remove('is-loading'); btn.disabled = false;
    }
  });

  // =========================
  // Notes modal (iPad friendly)
  // =========================
  function openNoteModal(text) {
    if (!noteModal) return;
    noteModalBody.textContent = text || 'No notes';
    noteModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeNoteModal() {
    if (!noteModal) return;
    noteModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  noteModalClose?.addEventListener('click', closeNoteModal);
  noteModal?.addEventListener('click', (e) => {
    if (e.target?.dataset?.close) closeNoteModal(); // click backdrop to close
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNoteModal();
  });
  issuesBody?.addEventListener('click', (e) => {
    const v = e.target.closest('.note-view-btn');
    if (!v) return;
    const cell = v.closest('.cell-notes');
    const escaped = cell?.dataset.note || '';
    const full = decodeEntities(escaped);
    openNoteModal(full);
  });

  // =========================
  // collapsible + init loads
  // =========================
  const newIssueToggle = document.getElementById('newIssueToggle');
  if (newIssueToggle) {
    newIssueToggle.addEventListener('click', () => {
      const content = newIssueToggle.nextElementSibling;
      if (content) {
        newIssueToggle.classList.toggle('active');
        content.classList.toggle('active');
      }
    });
  }

  // initial loads
  if (document.getElementById('tab-gameroom')?.classList.contains('active')) {
    fetchAndPopulateGames();
  }
  loadList();
  populateEmployees();

  // Employees live refresh (between tabs/windows)
  const EMP_KEY = 'employees.updated';
  let lastEmpUpdate = localStorage.getItem(EMP_KEY) || '0';
  window.addEventListener('focus', () => {
    const ts = localStorage.getItem(EMP_KEY) || '0';
    if (ts !== lastEmpUpdate) {
      lastEmpUpdate = ts;
      populateEmployees();
    }
  });
  try {
    const bc = new BroadcastChannel('employees');
    bc.addEventListener('message', (e) => {
      if (e.data === 'updated') {
        lastEmpUpdate = localStorage.getItem(EMP_KEY) || Date.now().toString();
        populateEmployees();
      }
    });
  } catch {}

  window.refreshIssuesTableData = loadList;

});
