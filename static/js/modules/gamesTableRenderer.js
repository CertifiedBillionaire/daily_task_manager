// =========================================================================
// ARCADE MANAGER - GAME INVENTORY TABLE RENDERER
// Renders the Games table, wires row actions, and updates the uptime badge.
//
// What this file does:
// - Fetches /api/games and renders a table into #games-table-container
// - Shows status badges (Up/Down) and a “Last Updated” column (unchanged for now)
// - Replaces per-row Action buttons with a compact three-dot (kebab) menu
// - Wires Edit (inline editor) and Delete (with confirm) actions
// - Updates the “Current Game Uptime: XX%” badge under the page title
//
// Depends on:
// - ./gameInlineEditor.js  (openGameInlineEditor)
// - Backend endpoints: GET /api/games, DELETE /api/games/:id
// - Template anchor: #games-table-container (in templates/game_inventory.html)
// - Styles in: static/css/sections/game_inventory.css (.games-table, .status-badge, kebab menu)
//
// Exports:
// - renderGamesTable()
// =========================================================================

import { openGameInlineEditor } from './gameInlineEditor.js';

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
        const idNum = String(game.id ?? '').trim();
        const paddedId = idNum ? String(idNum).padStart(3, '0') : '';
        const statusBadge =
          game.status === 'Down'
            ? `<span class="status-badge down">Down</span>`
            : `<span class="status-badge up">Up</span>`;

        html += `
          <tr data-row-id="${escapeAttr(game.id)}">
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
                        aria-controls="kebab-menu-${escapeAttr(game.id)}"
                        data-id="${escapeAttr(game.id)}">
                  <i class="fas fa-ellipsis-v"></i>
                </button>

                <div id="kebab-menu-${escapeAttr(game.id)}" class="kebab-menu" style="display:none;">
                  <button class="menu-item edit-game-btn"
                          data-id="${escapeAttr(game.id)}"
                          data-name="${encodeURIComponent(game.name || '')}"
                          data-status="${escapeAttr(game.status || 'Up')}"
                          data-reason="${encodeURIComponent(game.down_reason || '')}">
                    <i class="fas fa-pencil"></i> Edit
                  </button>
                  <button class="menu-item delete-game-btn" data-id="${escapeAttr(game.id)}">
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

    // ---- Uptime badge update (keep here so it runs after fetch/render) ----
    const uptimeEl = document.getElementById('uptime-badge');
    if (uptimeEl) {
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

    // ---- Events: kebab toggle, edit, delete, outside click close ----
    wireInteractions(container);

  } catch (err) {
    console.error("❌ Failed to load games:", err);
    container.innerHTML = `<p style="color:red;">Error loading games</p>`;
  }
}

/* ===================== Internal helpers ===================== */

function wireInteractions(container) {
  // Close all menus helper
  const closeAllKebabMenus = () => {
    container.querySelectorAll('.kebab-menu').forEach(m => (m.style.display = 'none'));
    container.querySelectorAll('.kebab-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  };

  // Use one delegated listener for all clicks inside the table container
  container.addEventListener('click', async (e) => {
    const kebabBtn = e.target.closest('.kebab-btn');
    const editBtn  = e.target.closest('.edit-game-btn');
    const delBtn   = e.target.closest('.delete-game-btn');

    // Toggle kebab menu
    if (kebabBtn) {
      e.stopPropagation();
      const id = kebabBtn.getAttribute('data-id');
      const menu = container.querySelector(`#kebab-menu-${CSS.escape(id)}`);
      const isOpen = menu && menu.style.display !== 'none';

      closeAllKebabMenus();
      if (menu) {
        menu.style.display = isOpen ? 'none' : 'block';
        kebabBtn.setAttribute('aria-expanded', String(!isOpen));
      }
      return;
    }

    // Edit → open inline editor
    if (editBtn) {
      e.preventDefault();
      const id = Number(editBtn.getAttribute('data-id'));
      const rowEl = container.querySelector(`tr[data-row-id="${CSS.escape(String(id))}"]`);
      const name = decodeURIComponent(editBtn.getAttribute('data-name') || '');
      const status = editBtn.getAttribute('data-status') || 'Up';
      const down_reason = decodeURIComponent(editBtn.getAttribute('data-reason') || '');
      closeAllKebabMenus();
      openGameInlineEditor({ rowEl, id, name, status, down_reason });
      return;
    }

    // Delete → confirm + call API + refresh
    if (delBtn) {
      e.preventDefault();
      const id = delBtn.getAttribute('data-id');
      closeAllKebabMenus();
      if (!confirm("Delete this game?")) return;

      try {
        const res = await fetch(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await safeJson(res);
          alert(`Error deleting game: ${err.error || res.statusText}`);
          return;
        }
        // Refresh table (& uptime)
        await renderGamesTable();
      } catch (err) {
        console.error("❌ Failed to delete game:", err);
        alert("Failed to delete game. See console for details.");
      }
      return;
    }

    // Click anywhere else inside the table → close menus if click isn't inside a menu
    if (!e.target.closest('.kebab-menu')) {
      closeAllKebabMenus();
    }
  });

  // Also close menus if user clicks outside the container altogether
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      // Close if the click isn’t inside the table area
      container.querySelectorAll('.kebab-menu').forEach(m => (m.style.display = 'none'));
      container.querySelectorAll('.kebab-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }
  }, { capture: true });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

async function safeJson(res) {
  try { return await res.json(); }
  catch { return {}; }
}
