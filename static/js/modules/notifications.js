// static/js/modules/notifications.js
(function(){
  const bell = document.getElementById('notificationButton');
  if (!bell) return;

  const state = { items: [], open: false };

  function todayStart(){ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  const fmtId = id => typeof id !== 'number' ? id : `IH-${String(id).padStart(3,'0')}`;
  const fmtDate = s => s ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(s)) : '';
  const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
                                  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");

  async function fetchList(status, category){
    const r = await fetch(`/api/issuehub/list?category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}`);
    const j = await r.json().catch(()=>({items:[]}));
    return Array.isArray(j.items) ? j.items : [];
  }

  async function loadAlerts(){
    const cutoff = todayStart().getTime();

    // stale "in progress" (yesterday or older)
    const [gmIP, fcIP] = await Promise.all([
      fetchList('in_progress','gameroom'),
      fetchList('in_progress','facility'),
    ]);
    const stale = [...gmIP, ...fcIP].filter(it =>
      new Date(it.updated_at || it.created_at || 0).getTime() < cutoff
    ).map(x => ({...x, _type:'stale_in_progress'}));

    // overdue target_date (active-ish)
    const active = await Promise.all([
      fetchList('open','gameroom'), fetchList('in_progress','gameroom'),
      fetchList('open','facility'), fetchList('in_progress','facility'),
    ]).then(a => a.flat());
    const overdue = active.filter(it => {
      if (!it.target_date) return false;
      const s = (it.status||'').toLowerCase();
      const isPast = new Date(it.target_date).getTime() < cutoff;
      return isPast && s!=='resolved' && s!=='archived' && s!=='trash';
    }).map(x => ({...x, _type:'overdue_target'}));

    // de-dupe
    const m = new Map();
    [...stale, ...overdue].forEach(it => m.set(String(it.id), it));
    state.items = [...m.values()];
    updateBadge();
  }

  function ensureStyles(){
    if (document.getElementById('notif-style')) return;
    const st = document.createElement('style');
    st.id='notif-style';
    st.textContent = `
      #notificationButton{ position: relative; }
      .notif-badge{ position:absolute; top:-2px; right:-2px; min-width:16px; height:16px; padding:0 4px;
        border-radius:999px; background:#ef4444; color:#fff; font-weight:700; font-size:10px;
        display:flex; align-items:center; justify-content:center; }
      .notif-panel{ position:fixed; right:16px; top:64px; width:min(420px,92vw); max-height:70vh; overflow:auto;
        background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.22); z-index:10000; }
      .notif-panel__hd{ padding:12px 14px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between; }
      .notif-panel__bd{ padding:6px 0; }
      .notif-item{ display:flex; gap:10px; padding:10px 14px; align-items:flex-start; border-bottom:1px solid #f3f4f6; }
      .notif-item:last-child{ border-bottom:0; }
      .notif-item .meta{ font-size:12px; opacity:.8; }
      .notif-actions{ margin-left:auto; display:flex; gap:6px; }
      .notif-actions button{ border:0; padding:6px 10px; border-radius:8px; cursor:pointer; }
      .n-act-view{ background:#e5e7eb; }
      .n-act-open{ background:#fff1d6; }
      .n-act-resolve{ background:#e8f8ee; }
      .notif-empty{ padding:16px; text-align:center; opacity:.7; }
    `;
    document.head.appendChild(st);
  }

  function updateBadge(){
    ensureStyles();
    bell.querySelector('.notif-badge')?.remove();
    const n = state.items.length;
    if (!n) return;
    const b = document.createElement('span');
    b.className = 'notif-badge';
    b.textContent = n>99 ? '99+' : String(n);
    bell.appendChild(b);
  }

  function buildPanel(){
    const wrap = document.createElement('div');
    wrap.className = 'notif-panel';
    wrap.innerHTML = `
      <div class="notif-panel__hd">
        <strong>Alerts</strong>
        <button class="n-close" type="button">Close</button>
      </div>
      <div class="notif-panel__bd">
        ${state.items.length ? state.items.map(it => `
          <div class="notif-item" data-id="${it.id}">
            <div>
              <div><b>${fmtId(it.id)}</b> — ${esc(it.title||'')}</div>
              <div class="meta">
                ${esc(it.location || it.category || '')}
                • ${it._type==='overdue_target' ? 'Target overdue' : `In Progress since ${fmtDate(it.updated_at || it.created_at)}`}
              </div>
            </div>
            <div class="notif-actions">
              <button class="n-act-view" data-act="view">View</button>
              ${it._type==='overdue_target'
                ? `<button class="n-act-open" data-act="open">Re-open</button>`
                : `<button class="n-act-resolve" data-act="resolve">Resolve…</button>`}
            </div>
          </div>
        `).join('') : `<div class="notif-empty">No alerts 🎉</div>`}
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  async function updateStatus(id, status, resolution){
    const payload = { id, status };
    if (status==='resolved' && resolution) payload.resolution = resolution;
    const r = await fetch('/api/issuehub/update_status', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(j.error || 'Update failed');
  }

  let panel = null;
  function closePanel(){ panel?.remove(); panel=null; state.open=false; }

  bell.addEventListener('click', async () => {
    if (state.open) { closePanel(); return; }
    await loadAlerts();
    panel = buildPanel();
    state.open = true;

    panel.addEventListener('click', async (e) => {
      if (e.target.closest('.n-close')) { closePanel(); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const row = btn.closest('.notif-item');
      const id = row?.dataset.id;
      const act = btn.dataset.act;

      try {
        if (act === 'view') {
        // normalize id: if it's numeric, format as IH-###; else pass through
        const n = Number(id);
        const focusId = Number.isFinite(n) ? `IH-${String(n).padStart(3,'0')}` : String(id);
        window.location.href = `/issuehub?focus=${encodeURIComponent(focusId)}`;
        return;
        }
        if (act === 'open') {
          await updateStatus(id, 'open');
        } else if (act === 'resolve') {
          const note = prompt('Resolution note?');
          if (!note) return;
          await updateStatus(id, 'resolved', note);
        }
        row.remove();
        state.items = state.items.filter(x => String(x.id) !== String(id));
        updateBadge();
        if (!panel.querySelector('.notif-item')) {
          panel.querySelector('.notif-panel__bd').innerHTML = `<div class="notif-empty">No alerts 🎉</div>`;
        }
        if (window.refreshIssuesTableData) window.refreshIssuesTableData();
      } catch (err) {
        alert(err.message || 'Action failed');
      }
    });

    // click-away
    setTimeout(() => {
      const off = (ev) => {
        if (!panel || panel.contains(ev.target) || bell.contains(ev.target)) return;
        document.removeEventListener('click', off);
        closePanel();
      };
      document.addEventListener('click', off);
    }, 0);
  });

  // refresh badge periodically and on focus
  loadAlerts();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAlerts(); });
  setInterval(loadAlerts, 60000);
})();
