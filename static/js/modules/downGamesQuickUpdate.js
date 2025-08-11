// =========================================================================
// ARCADE MANAGER - DASHBOARD QUICK UPDATE (ALL GAMES SEARCH & TOGGLE)
// Opens a modal from the “Update Down Games” card, lets you search ALL games,
// and flip status: Mark Up (if Down) / Mark Down (if Up).
//
// What this file does:
// - Card click opens a modal
// - Loads all games (GET /api/games)
// - Renders a small search box with a Clear (×) button
// - Filters as you type
// - Shows status badges per row
// - Action button: Mark Up / Mark Down (with confirm + optional reason for Down)
// - On success: updates in-memory list, re-renders, refreshes dashboard counts,
//   and shows a tiny green notice at the top of the modal
//
// Connected files:
// - templates/index.html (modal markup + #downGamesCard)
// - dashboardDownGamesCard.js (refreshes count/uptime on the card)
// - static/css/components/cards.css (modal + list + toast + search styles)
// - Backend: GET /api/games, PUT /api/games/<id>
//
// Exports:
// - initDownGamesQuickUpdate()
// =========================================================================

import { initDownGamesCard } from './dashboardDownGamesCard.js';

const sel = (q, root = document) => root.querySelector(q);

let allGames = [];
let lastTerm = '';

function getEls() {
  return {
    card: sel('#downGamesCard'),
    modal: sel('#downGamesModal'),
    panel: sel('#downGamesModal .simple-modal__panel'),
    body: sel('#dgm-body'),
  };
}

async function fetchGames() {
  const res = await fetch('/api/games');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  const closeBtn = modal.querySelector('.simple-modal__close');
  closeBtn && closeBtn.focus();
  document.addEventListener('keydown', onEscClose, true);
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  document.removeEventListener('keydown', onEscClose, true);
}

function onEscClose(e) {
  if (e.key === 'Escape') {
    const m = sel('#downGamesModal');
    closeModal(m);
  }
}

function showToast(text, type = 'success') {
  const { modal, panel, body } = getEls();
  if (!panel || !body) return;

  let toast = modal.querySelector('.dgm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'dgm-toast';
    panel.insertBefore(toast, body); // above the list
  }
  toast.textContent = text;
  toast.classList.toggle('is-error', type === 'error');

  toast.style.opacity = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

/* ---------- rendering ---------- */

function renderShell(body) {
  body.innerHTML = `
    <div class="dgm-search">
      <input id="dgm-search-input" type="text" placeholder="Search games…" aria-label="Search games">
      <button id="dgm-search-clear" type="button" aria-label="Clear search" title="Clear">&times;</button>
    </div>
    <ul class="dgm-list" id="dgm-list"></ul>
  `;
}

function rowTemplate(g) {
  const badge =
    g.status === 'Down'
      ? `<span class="dgm-badge dgm-badge--down">Down</span>`
      : `<span class="dgm-badge dgm-badge--up">Up</span>`;

  const reason =
    g.status === 'Down' && g.down_reason
      ? ` — <span class="dgm-reason">${escapeHtml(g.down_reason)}</span>`
      : '';

  const action =
    g.status === 'Down'
      ? `<button class="dgm-toggle-btn" type="button" data-action="up" data-name="${escapeAttr(g.name || 'Unnamed')}" data-id="${escapeAttr(g.id)}">Mark Up</button>`
      : `<button class="dgm-toggle-btn" type="button" data-action="down" data-name="${escapeAttr(g.name || 'Unnamed')}" data-id="${escapeAttr(g.id)}">Mark Down</button>`;

  return `
    <li class="dgm-item" data-id="${escapeAttr(g.id)}">
      <div class="dgm-left">
        <span class="dgm-name">${escapeHtml(g.name || 'Unnamed')}</span>${reason}
      </div>
      <div class="dgm-right">
        ${badge}
        ${action}
      </div>
    </li>
  `;
}

function drawList(games, term = '') {
  const list = sel('#dgm-list');
  if (!list) return;

  const lc = term.trim().toLowerCase();
  // sort: Down first, then name
  const sorted = [...games].sort((a, b) => {
    const aDown = a.status === 'Down' ? 1 : 0;
    const bDown = b.status === 'Down' ? 1 : 0;
    if (aDown !== bDown) return bDown - aDown;
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    return an.localeCompare(bn);
  });

  const filtered = lc
    ? sorted.filter(g =>
        (g.name || '').toLowerCase().includes(lc) ||
        String(g.id || '').toLowerCase().includes(lc)
      )
    : sorted;

  if (filtered.length === 0) {
    list.innerHTML = `<li class="dgm-item dgm-item--empty"><div class="dgm-left">No games match “${escapeHtml(term)}”.</div></li>`;
    return;
  }

  list.innerHTML = filtered.map(rowTemplate).join('');
}

function toggleClearBtnVisibility(input, clearBtn) {
  if (!clearBtn) return;
  clearBtn.style.display = input.value ? 'inline-flex' : 'none';
}

async function loadAll(body) {
  body.innerHTML = `<div class="dgm-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>`;
  try {
    allGames = await fetchGames();
    renderShell(body);

    const input = sel('#dgm-search-input');
    const clearBtn = sel('#dgm-search-clear');

    input.value = lastTerm;
    drawList(allGames, lastTerm);
    toggleClearBtnVisibility(input, clearBtn);

    input.addEventListener('input', () => {
      lastTerm = input.value;
      drawList(allGames, lastTerm);
      toggleClearBtnVisibility(input, clearBtn);
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      lastTerm = '';
      drawList(allGames, '');
      toggleClearBtnVisibility(input, clearBtn);
      input.focus();
    });
  } catch (e) {
    console.error('QuickUpdate: failed to load', e);
    body.innerHTML = `<p class="dgm-error">Failed to load games.</p>`;
  }
}

/* ---------- actions ---------- */

async function markStatus(id, target, btn, name, reason = null) {
  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

    const res = await fetch(`/api/games/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: target, down_reason: reason }),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.error || res.statusText);
    }

    // update local copy
    const idx = allGames.findIndex(g => String(g.id) === String(id));
    if (idx !== -1) {
      allGames[idx] = {
        ...allGames[idx],
        status: target,
        down_reason: target === 'Down' ? (reason || null) : null,
      };
    }

    // refresh dashboard counters
    await initDownGamesCard();

    // redraw list (keeps search term)
    drawList(allGames, lastTerm);

    // toast
    showToast(
      target === 'Up' ? `Marked Up: ${name}` : `Marked Down: ${name}`,
      'success'
    );
  } catch (e) {
    console.error('Mark status failed', e);
    btn.disabled = false;
    btn.textContent = target === 'Up' ? 'Mark Up' : 'Mark Down';
    showToast('Update failed.', 'error');
    alert('Failed to update. See console for details.');
  }
}

/* ---------- wiring ---------- */

function wireModalEvents(modal, body) {
  // Close on overlay or X
  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal(modal);
  });

  // Delegate clicks on Mark Up / Mark Down
  body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.dgm-toggle-btn');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const name = btn.getAttribute('data-name') || 'this game';
    const action = btn.getAttribute('data-action'); // 'up' | 'down'
    if (!id || !action) return;

    if (action === 'up') {
      const ok = confirm(`Put “${name}” back in service (Up)?`);
      if (!ok) return;
      await markStatus(id, 'Up', btn, name, null);
    } else {
      const ok = confirm(`Mark “${name}” as Down?`);
      if (!ok) return;
      let reason = prompt('Reason (optional):', '');
      if (reason === null) reason = '';
      await markStatus(id, 'Down', btn, name, reason.trim() || null);
    }
  });
}

export function initDownGamesQuickUpdate() {
  const { card, modal, body } = getEls();
  if (!card || !modal || !body) return;

  // Open on click
  card.addEventListener('click', () => {
    openModal(modal);
    loadAll(body);
  });

  // Open on Enter/Space (keyboard)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(modal);
      loadAll(body);
    }
  });

  wireModalEvents(modal, body);
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDownGamesQuickUpdate);
} else {
  initDownGamesQuickUpdate();
}

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}