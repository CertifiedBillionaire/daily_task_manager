// =========================================================================
// ARCADE MANAGER - GAME INVENTORY TABLE RENDERER
// Renders the Games table, wires row actions (Edit/Delete), and updates uptime.
//
// What this file does:
// - Fetches /api/games and renders into #games-table-container
// - Shows Up/Down badges and a “Last Updated” column (time trimming next step)
// - Uses a compact three-dot (kebab) Actions menu per row
// - Wires Edit (inline editor) and Delete (with confirm) actions
// - Updates the “Current Game Uptime: XX%” badge under the title
//
// Connected files:
// - ./gameInlineEditor.js  (provides openGameInlineEditor)
// - static/css/sections/game_inventory.css  (table, badges, kebab styles)
// - templates/game_inventory.html  (has #games-table-container and header badge)
//
// Exports:
// - renderGamesTable()
// =========================================================================

import { openGameInlineEditor } from './gameInlineEditor.js';

let outsideClickHandlerAttached = false; // ensure we attach once

export async function renderGamesTable() {
  const container = document.querySelector('#games-table-container');
  if (!container) {
    console.error("❌ gamesTableRenderer: #games-table-container not found");
    return;
  }

  try {
    const res = await fetch('/api/games');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const games = await res.json();

    // Build table
    let html = `
      <table class="games-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Down Reason</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (!games || games.length === 0) {
      html += `<tr><td colspan="6" style="text-align:center;">No games found</td></tr>`;
    } else {
      for (const game of games) {
        const idRaw = game.id ?? '';
        const paddedId = String(idRaw).padStart(3, '0');
        const statusBadge =
          game.status === 'Down'
            ? `<span class="status-badge down">Down</span>`
            : `<span class="status-badge up">Up</span>`;

        html += `
          <tr data-row-id="${escapeAttr(String(game.id))}">
            <td>${paddedId}</td>
            <td>${escapeHtml(game.name)}</td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(game.down_reason || '')}</td>
            <td>${escapeHtml(game.updated_at || '')}</td>
            <td>
              <div class="kebab-wrap">
                <button class="kebab-btn"
                        type="button"
                        aria-expanded="false"
                        aria-haspopup="true"
                        aria-controls="kebab-menu-${escapeAttr(String(game.id))}"
                        data-id="${escapeAttr(String(game.id))}">
                  <i class="fas fa-ellipsis-v"></i>
                </button>

                <div id="kebab-menu-${escapeAttr(String(game.id))}" class="kebab-menu" style="display:none;">
                  <button class="menu-item edit-game-btn"
                          data-id="${escapeAttr(String(game.id))}"
                          data-name="${encodeURIComponent(game.name || '')}"
                          data-status="${escapeAttr(game.status || 'Up')}"
                          data-reason="${encodeURIComponent(game.down_reason || '')}">
                    <i class="fas fa-pencil"></i> Edit
                  </button>
                  <button class="menu-item delete-game-btn" data-id="${escapeAttr(String(game.id))}">
                    <i class="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            </td>
          </tr>
        `;
      }
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Uptime badge
    updateUptimeBadge(games);

    // Events (menu toggle, edit, delete)
    wireInteractions(container);

    // Attach outside-click closer ONCE (fixes stuck menus after cancel)
    attachOutsideCloseOnce();

  } catch (err) {
    console.error("❌ Failed to load games:", err);
    container.innerHTML = `<p style="color:red;">Error loading games</p>`;
  }
}

/* ===================== Internal helpers ===================== */

function updateUptimeBadge(games) {
  const uptimeEl = document.getElementById('uptime-badge');
  if (!uptimeEl) return;

  const total = games.length;
  const upCount = games.filter(g => g.status === 'Up').length;
  const uptime = total > 0 ? Math.round((upCount / total) * 100) : 100;

  uptimeEl.textContent = `Current Game Uptime: ${uptime}%`;
  uptimeEl.classList.remove('good', 'warn', 'bad', 'neutral');
  if (total === 0) uptimeEl.classList.add('neutral');
  else if (uptime >= 95) uptimeEl.classList.add('good');
  else if (uptime >= 80) uptimeEl.classList.add('warn');
  else uptimeEl.classList.add('bad');
}

function wireInteractions(container) {
  // Close all menus inside this container
  const closeAllKebabMenus = () => {
    container.querySelectorAll('.kebab-menu').forEach(m => (m.style.display = 'none'));
    container.querySelectorAll('.kebab-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  };

  // One delegated listener for clicks within the table container
  container.addEventListener('click', async (e) => {
    const kebabBtn = e.target.closest('.kebab-btn');
    const editBtn  = e.target.closest('.edit-game-btn');
    const delBtn   = e.target.closest('.delete-game-btn');

    // Toggle kebab menu
    if (kebabBtn) {
      e.stopPropagation();
      const id = kebabBtn.getAttribute('data-id') || '';
      const menu = container.querySelector(`#kebab-menu-${cssEscape(id)}`);
      const isOpen = menu && menu.style.display !== 'none';

      closeAllKebabMenus();
      if (menu) {
        menu.style.display = isOpen ? 'none' : 'block';
        kebabBtn.setAttribute('aria-expanded', String(!isOpen));
      }
      return;
    }

    // Edit
    if (editBtn) {
      e.preventDefault();
      const id = editBtn.getAttribute('data-id') || '';
      const rowEl = container.querySelector(`tr[data-row-id="${cssEscape(id)}"]`);
      const name = decodeURIComponent(editBtn.getAttribute('data-name') || '');
      const status = editBtn.getAttribute('data-status') || 'Up';
      const down_reason = decodeURIComponent(editBtn.getAttribute('data-reason') || '');
      closeAllKebabMenus();
      openGameInlineEditor({ rowEl, id: Number(id), name, status, down_reason });
      return;
    }

    // Delete
    if (delBtn) {
      e.preventDefault();
      const id = delBtn.getAttribute('data-id') || '';
      closeAllKebabMenus();
      if (!confirm("Delete this game?")) return;

      try {
        const res = await fetch(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await safeJson(res);
          alert(`Error deleting game: ${err.error || res.statusText}`);
          return;
        }
        await renderGamesTable(); // refresh table & uptime
      } catch (err) {
        console.error("❌ Failed to delete game:", err);
        alert("Failed to delete game. See console for details.");
      }
      return;
    }

    // Click inside container but not on a menu or kebab → close menus
    if (!e.target.closest('.kebab-menu') && !e.target.closest('.kebab-btn')) {
      closeAllKebabMenus();
    }
  });
}

// Attach a single outside-click handler (no { once:true }, no stacking)
function attachOutsideCloseOnce() {
  if (outsideClickHandlerAttached) return;
  document.addEventListener('click', (e) => {
    const container = document.querySelector('#games-table-container');
    if (!container) return;

    const clickedInsideContainer = container.contains(e.target);
    const onMenuOrBtn = e.target.closest('.kebab-menu') || e.target.closest('.kebab-btn');

    // If click is outside container OR inside but not on the menu/btn → close all
    if (!clickedInsideContainer || !onMenuOrBtn) {
      container.querySelectorAll('.kebab-menu').forEach(m => (m.style.display = 'none'));
      container.querySelectorAll('.kebab-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }
  }, true); // capture so this runs before bubbling handlers
  outsideClickHandlerAttached = true;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/"/g, '\\"');
}
async function safeJson(res) {
  try { return await res.json(); }
  catch { return {}; }
}
