// static/js/modules/rollover_nudge.js
(function () {
    // Only run on Issue Hub
  if (!document.querySelector('.issue-hub')) return;
  const LAST_NUDGE_KEY = 'issuehub.lastNudgeDate';

  // Try to identify "me" for filtering
  const me =
    (window.currentUser && window.currentUser.name) ||
    window.CURRENT_USER_NAME ||
    localStorage.getItem('me_name') || // optional: let users store their name once
    '';

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function isNewDay() {
    const last = localStorage.getItem(LAST_NUDGE_KEY);
    return last !== todayKey();
  }

  function markShownToday() {
    localStorage.setItem(LAST_NUDGE_KEY, todayKey());
  }

  function startOfToday() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const fmtId = (id) => (typeof id !== 'number' ? id : `IH-${String(id).padStart(3,'0')}`);
  const fmtDate = (s) => (s ? new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric' }).format(new Date(s)) : '');

  async function fetchInProgress(cat) {
    const r = await fetch(`/api/issuehub/list?category=${encodeURIComponent(cat)}&status=in_progress`);
    const j = await r.json().catch(() => ({ items: [] }));
    return Array.isArray(j.items) ? j.items : [];
  }

  async function getStaleInProgress() {
    const [gm, fc] = await Promise.all([fetchInProgress('gameroom'), fetchInProgress('facility')]);
    const all = [...gm, ...fc];

    const cutoff = startOfToday().getTime();
    let list = all.filter(it => {
      const t = new Date(it.updated_at || it.created_at || 0).getTime();
      return t < cutoff; // from a previous day
    });

    if (me) {
      const meL = me.toLowerCase();
      list = list.filter(it => (it.assignee || '').toLowerCase() === meL);
    }

    return list;
  }

  function ensureStyles() {
    if (document.getElementById('nudge-style')) return;
    const st = document.createElement('style');
    st.id = 'nudge-style';
    st.textContent = `
      .nudge-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:10000;}
      .nudge{background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);width:min(720px,94vw);max-height:80vh;display:flex;flex-direction:column;}
      .nudge__hd{padding:16px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;}
      .nudge__bd{padding:12px 16px;overflow:auto;}
      .nudge__ft{padding:12px 16px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end;}
      .nudge h3{margin:0;font-size:18px}
      .nudge table{width:100%;border-collapse:separate;border-spacing:0 8px;}
      .nudge tr{background:#f9fafb;}
      .nudge td{padding:10px 12px;vertical-align:middle;}
      .nudge .id{font-weight:700;white-space:nowrap;}
      .nudge .where{opacity:.85;}
      .nudge .when{opacity:.8;white-space:nowrap;}
      .nudge .row-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .nudge button{border:0;border-radius:10px;padding:8px 10px;cursor:pointer}
      .nudge .b-keep{background:#e6f0ff}
      .nudge .b-stop{background:#fff1d6}
      .nudge .b-resolve{background:#e8f8ee}
      .nudge .b-close, .nudge .b-snooze{background:#e5e7eb}
    `;
    document.head.appendChild(st);
  }

  function buildModal(items) {
    ensureStyles();
    const $b = document.createElement('div');
    $b.className = 'nudge-backdrop';
    $b.innerHTML = `
      <div class="nudge" role="dialog" aria-modal="true" aria-label="Yesterday's in-progress issues">
        <div class="nudge__hd">
          <h3>Still working on these?</h3>
          <button class="b-close" type="button" aria-label="Close">Close</button>
        </div>
        <div class="nudge__bd">
          <table>
            <tbody>
              ${items.map(it => `
                <tr data-id="${it.id}">
                  <td class="id">${fmtId(it.id)}</td>
                  <td><div><strong>${(it.title || '').replace(/</g,'&lt;')}</strong></div>
                      <div class="where">${(it.location || '').replace(/</g,'&lt;')}</div></td>
                  <td class="when">Updated ${fmtDate(it.updated_at || it.created_at)}</td>
                  <td>
                    <div class="row-actions">
                      <button class="b-keep"    data-act="keep">Still working</button>
                      <button class="b-stop"    data-act="stop">Stopped</button>
                      <button class="b-resolve" data-act="resolve">Resolved…</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="nudge__ft">
          <button class="b-snooze" type="button">Snooze till tomorrow</button>
          <button class="b-close"  type="button">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild($b);
    return $b;
  }

  async function updateStatus(id, status, resolutionNote) {
    const payload = { id, status };
    if (status === 'resolved' && resolutionNote) payload.resolution = resolutionNote;
    const r = await fetch('/api/issuehub/update_status', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'Update failed');
    }
  }

  function wireModal($modal) {
    const closeAll = () => { $modal.remove(); markShownToday(); };

    $modal.addEventListener('click', async (e) => {
      // close / snooze
      if (e.target.closest('.b-close')) { closeAll(); return; }
      if (e.target.closest('.b-snooze')) { closeAll(); return; }

      // per-row actions
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const tr = btn.closest('tr[data-id]');
      const id = tr?.dataset.id;
      if (!id) return;

      btn.disabled = true;
      try {
        const act = btn.dataset.act;
        if (act === 'keep') {
          // Optional: you could ping the server to "touch" updated_at by re-setting in_progress.
          await updateStatus(id, 'in_progress');
        } else if (act === 'stop') {
          await updateStatus(id, 'open');
        } else if (act === 'resolve') {
          const note = prompt('Resolution note (what fixed it)?');
          if (!note) { btn.disabled = false; return; }
          await updateStatus(id, 'resolved', note);
        }
        tr.remove();
        // If list empties, auto-close.
        if (!$modal.querySelector('tbody tr')) closeAll();
        if (window.refreshIssuesTableData) window.refreshIssuesTableData();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Action failed');
        btn.disabled = false;
      }
    });
  }

  async function maybeShowNudge() {
    if (!isNewDay()) return; // already shown today
    let items;
    try { items = await getStaleInProgress(); }
    catch { items = []; }

    if (!items.length) { markShownToday(); return; }

    const $m = buildModal(items);
    wireModal($m);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // small delay so the rest of the UI can boot first
    setTimeout(maybeShowNudge, 400);
  });
})();
