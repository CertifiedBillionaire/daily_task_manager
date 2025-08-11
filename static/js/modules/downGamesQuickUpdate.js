// =========================================================================
// ARCADE MANAGER - DASHBOARD QUICK UPDATE (DOWN GAMES)
// Opens a minimal modal listing games that are Down and lets you mark them Up.
//
// What this file does:
// - Makes the "Update Down Games" card open a modal
// - Lists all games with status === "Down" (name + reason)
// - "Mark Up" asks to confirm, then PUT /api/games/<id> { status: "Up", down_reason: null }
// - On success: removes item, refreshes counts, and shows a green notice
//
// Connected files:
// - templates/index.html (modal markup + #downGamesCard)
// - dashboardDownGamesCard.js (refreshes counts/uptime)
// - static/css/components/cards.css (modal + toast styles)
// - Backend: GET /api/games, PUT /api/games/<id>
// =========================================================================

import { initDownGamesCard } from './dashboardDownGamesCard.js';

const sel = (q, root = document) => root.querySelector(q);

function getEls() {
  return {
    card: sel('#downGamesCard'),
    modal: sel('#downGamesModal'),
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

function renderEmpty(body) {
  body.innerHTML = `
    <div class="dgm-empty">
      <i class="fas fa-check-circle"></i>
      <p>All games are up. 🎉</p>
    </div>
  `;
}

function rowTemplate(g) {
  const reason = g.down_reason ? ` — <span class="dgm-reason">${escapeHtml(g.down_reason)}</span>` : '';
  return `
    <li class="dgm-item" data-id="${escapeAttr(g.id)}">
      <div class="dgm-main">
        <span class="dgm-name">${escapeHtml(g.name || 'Unnamed')}</span>${reason}
      </div>
      <button class="dgm-up-btn" type="button" data-name="${escapeAttr(g.name || 'Unnamed')}">Mark Up</button>
    </li>
  `;
}

async function loadDownList(body) {
  body.innerHTML = `<div class="dgm-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>`;
  try {
    const games = await fetchGames();
    const down = games.filter(g => g.status === 'Down');
    if (down.length === 0) {
      renderEmpty(body);
      return;
    }
    const items = down.map(rowTemplate).join('');
    body.innerHTML = `<ul class="dgm-list">${items}</ul>`;
  } catch (e) {
    console.error('QuickUpdate: failed to load', e);
    body.innerHTML = `<p class="dgm-error">Failed to load games.</p>`;
  }
}

function showToast(text, type = 'success') {
  const modal = sel('#downGamesModal');
  const panel = modal?.querySelector('.simple-modal__panel');
  const body = modal?.querySelector('.simple-modal__body');
  if (!panel || !body) return;

  let toast = modal.querySelector('.dgm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'dgm-toast';
    panel.insertBefore(toast, body); // show above the list
  }
  toast.textContent = text;
  toast.classList.toggle('is-error', type === 'error');

  toast.style.opacity = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

async function markUp(id, btn, name) {
  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

    const res = await fetch(`/api/games/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Up', down_reason: null }),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.error || res.statusText);
    }

    // remove item
    const li = btn.closest('.dgm-item');
    if (li) li.remove();

    // refresh dashboard counts
    await initDownGamesCard();

    // if list empty, show empty state
    const list = sel('.dgm-list');
    if (!list || list.children.length === 0) {
      const body = sel('#dgm-body');
      renderEmpty(body);
    }

    showToast(`Marked Up: ${name}`, 'success');
  } catch (e) {
    console.error('Mark Up failed', e);
    btn.disabled = false;
    btn.textContent = 'Mark Up';
    showToast('Failed to mark up.', 'error');
    alert('Failed to mark up. See console for details.');
  }
}

function wireModalEvents(modal, body) {
  // close on overlay or X
  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      closeModal(modal);
    }
  });

  // delegate clicks on "Mark Up" with confirm
  body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.dgm-up-btn');
    if (!btn) return;
    const li = btn.closest('.dgm-item');
    const id = li?.getAttribute('data-id');
    const name = btn.getAttribute('data-name') || li?.querySelector('.dgm-name')?.textContent || 'this game';
    if (!id) return;

    const ok = confirm(`Put “${name}” back in service (Up)?`);
    if (!ok) return;

    await markUp(id, btn, name);
  });
}

export function initDownGamesQuickUpdate() {
  const { card, modal, body } = getEls();
  if (!card || !modal || !body) return;

  // open on click
  card.addEventListener('click', () => {
    openModal(modal);
    loadDownList(body);
  });

  // open on Enter/Space (keyboard)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(modal);
      loadDownList(body);
    }
  });

  wireModalEvents(modal, body);
}

// auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDownGamesQuickUpdate);
} else {
  initDownGamesQuickUpdate();
}

/* helpers */
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