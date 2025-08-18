// =========================================================================
// ARCADE MANAGER - DASHBOARD QUICK UPDATE (ALL GAMES SEARCH & TOGGLE)
// =========================================================================

import { initDownGamesCard } from './dashboardDownGamesCard.js';

const sel = (q, root = document) => root.querySelector(q);

let allGames = [];
let lastTerm = '';

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

function showToast(text, type = 'success') {
  const { modal } = getEls();
  const panel = sel('.simple-modal__panel', modal);
  if (!panel) return;

  let toast = panel.querySelector('.dgm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'dgm-toast toast';
    panel.prepend(toast);
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

function rowTemplate(g) {
  const statusClass = g.status === 'Down' ? 'down' : 'up';
  const buttonText = g.status === 'Down' ? 'Mark Up' : 'Mark Down';
  const buttonAction = g.status === 'Down' ? 'up' : 'down';
  const buttonClass = g.status === 'Down' ? 'up' : 'down';

  return `
    <div class="game-list-item">
      <div class="game-title">${escapeHtml(g.name || 'Unnamed')}</div>
      <div class="game-status-buttons">
        <button class="status-button ${buttonClass}" type="button" data-action="${buttonAction}" data-id="${escapeAttr(g.id)}">${buttonText}</button>
      </div>
    </div>
  `;
}

function renderContent(body, games) {
  body.innerHTML = `
    <div class="dgm-search">
      <input id="dgm-search-input" type="text" placeholder="Search all games…" aria-label="Search games">
      <button id="dgm-search-clear" type="button" aria-label="Clear search" title="Clear">&times;</button>
    </div>
    
    <div id="down-games-list">
      <h4 style="margin-top: 20px;">Down Games</h4>
      <div class="game-list"></div>
    </div>

    <div id="all-games-list">
      <h4 style="margin-top: 20px;">All Games</h4>
      <div class="game-list"></div>
    </div>
  `;

  const downGamesList = sel('#down-games-list .game-list');
  const allGamesList = sel('#all-games-list .game-list');

  const downGames = games.filter(g => g.status === 'Down');
  const otherGames = games.filter(g => g.status !== 'Down');

  if (downGames.length > 0) {
    downGames.forEach(game => {
      downGamesList.innerHTML += rowTemplate(game);
    });
  } else {
    downGamesList.innerHTML = `<p style="padding: 10px 0;">All games are currently up!</p>`;
  }

  otherGames.forEach(game => {
    allGamesList.innerHTML += rowTemplate(game);
  });
}

async function loadAll(body) {
  body.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
  try {
    allGames = await fetchGames();
    renderContent(body, allGames);
    wireSearchAndFiltering();
  } catch (e) {
    console.error('QuickUpdate: failed to load', e);
    body.innerHTML = `<p style="text-align: center; color: red; padding: 20px;">Failed to load games.</p>`;
  }
}

function wireSearchAndFiltering() {
  const input = sel('#dgm-search-input');
  const clearBtn = sel('#dgm-search-clear');

  const filterAndDraw = () => {
    lastTerm = input.value.trim().toLowerCase();
    
    const downGamesList = sel('#down-games-list .game-list');
    const allGamesList = sel('#all-games-list .game-list');

    const downGames = allGames.filter(g => g.status === 'Down');
    const otherGames = allGames.filter(g => g.status !== 'Down');

    downGamesList.innerHTML = '';
    allGamesList.innerHTML = '';
    
    const downGamesFiltered = downGames.filter(g => (g.name || '').toLowerCase().includes(lastTerm));
    const otherGamesFiltered = otherGames.filter(g => (g.name || '').toLowerCase().includes(lastTerm));

    downGamesFiltered.forEach(game => downGamesList.innerHTML += rowTemplate(game));
    otherGamesFiltered.forEach(game => allGamesList.innerHTML += rowTemplate(game));
    
    if (downGamesFiltered.length === 0) {
      downGamesList.innerHTML = `<p style="padding: 10px 0;">No down games match your search.</p>`;
    }
    if (otherGamesFiltered.length === 0) {
      allGamesList.innerHTML = `<p style="padding: 10px 0;">No other games match your search.</p>`;
    }
  };

  input.addEventListener('input', filterAndDraw);
  clearBtn.addEventListener('click', () => {
    input.value = '';
    filterAndDraw();
    input.focus();
  });
  toggleClearBtnVisibility(input, clearBtn);
}

function toggleClearBtnVisibility(input, clearBtn) {
  if (!clearBtn) return;
  clearBtn.style.display = input.value ? 'inline-flex' : 'none';
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

    const updatedGame = await res.json();
    
    // Update local copy
    const idx = allGames.findIndex(g => String(g.id) === String(updatedGame.id));
    if (idx !== -1) {
      allGames[idx] = updatedGame;
    }

    // refresh dashboard counters
    await initDownGamesCard();

    // redraw list
    const { body } = getEls();
    renderContent(body, allGames);
    wireSearchAndFiltering();

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
    const btn = e.target.closest('.status-button');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    
    const game = allGames.find(g => String(g.id) === String(id));
    if (!game) return;
    const name = game.name || 'Unnamed Game';

    if (action === 'up') {
      const ok = confirm(`Put “${name}” back in service (Up)?`);
      if (!ok) return;
      await markStatus(id, 'Up', btn, name, null);
    } else if (action === 'down') {
      const ok = confirm(`Mark “${name}” as Down?`);
      if (!ok) return;
      let reason = prompt('Reason (optional):', '');
      if (reason === null) return;
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