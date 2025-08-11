// --- NEW CODE HERE ---
// gamesTableRenderer.js
// Handles fetching and rendering the Game Inventory table

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

        // Build table HTML
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

        if (games.length === 0) {
            html += `<tr><td colspan="6" style="text-align:center;">No games found</td></tr>`;
        } else {
            for (const game of games) {
                const paddedId = String(game.id).padStart(3, '0');

                // make the badge per-row
                const statusBadge = (game.status === 'Up')
                  ? `<span class="status-badge up">Up</span>`
                  : `<span class="status-badge down">Down</span>`;

                html += `
                    <tr data-row-id="${game.id}">
                        <td>${paddedId}</td>
                        <td>${game.name}</td>
                        <td>${statusBadge}</td>
                        <td>${game.down_reason || ''}</td>
                        <td>${game.updated_at || ''}</td>
                        <td>
                            <button class="edit-game-btn"
                                data-id="${game.id}"
                                data-name="${encodeURIComponent(game.name)}"
                                data-status="${game.status}"
                                data-reason="${encodeURIComponent(game.down_reason || '')}"
                                style="margin-right:8px;">
                                <i class="fas fa-pencil"></i>
                            </button>
                            <button class="delete-game-btn" data-id="${game.id}" style="color:red;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
        }

        html += `</tbody></table>`;
        container.innerHTML = html;

        // --- NEW CODE HERE ---
        // Update "Current Game Uptime" badge (must be inside renderGamesTable where 'games' exists)
        const uptimeEl = document.getElementById('uptime-badge');
        if (uptimeEl) {
            const total = games.length;
            const upCountForUptime = games.filter(g => g.status === 'Up').length;
            const uptime = total > 0 ? Math.round((upCountForUptime / total) * 100) : 100;

            uptimeEl.textContent = `Current Game Uptime: ${uptime}%`;

            // reset state classes
            uptimeEl.classList.remove('good', 'warn', 'bad', 'neutral');

            // color band
            if (total === 0) {
                uptimeEl.classList.add('neutral');
            } else if (uptime >= 95) {
                uptimeEl.classList.add('good');
            } else if (uptime >= 80) {
                uptimeEl.classList.add('warn');
            } else {
                uptimeEl.classList.add('bad');
            }
        }
        // --- END NEW CODE HERE ---
        // Handle EDIT clicks
        container.querySelectorAll('.edit-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                const rowEl = container.querySelector(`tr[data-row-id="${id}"]`);
                const name = decodeURIComponent(btn.getAttribute('data-name') || '');
                const status = btn.getAttribute('data-status') || 'Up';
                const down_reason = decodeURIComponent(btn.getAttribute('data-reason') || '');
                openGameInlineEditor({ rowEl, id, name, status, down_reason });
            });
        });

        // Handle DELETE clicks
        container.querySelectorAll('.delete-game-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const gameId = btn.getAttribute('data-id');
                if (!confirm("Delete this game?")) return;

                try {
                    const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const err = await safeJson(res);
                        alert(`Error deleting game: ${err.error || res.statusText}`);
                        return;
                    }
                    // Refresh table & counters
                    renderGamesTable();
                } catch (err) {
                    console.error("❌ Failed to delete game:", err);
                    alert("Failed to delete game. See console for details.");
                }
            });
        });

    } catch (err) {
        console.error("❌ Failed to load games:", err);
        container.innerHTML = `<p style="color:red;">Error loading games</p>`;
    }
}

async function safeJson(res) {
    try { return await res.json(); }
    catch { return {}; }
}
// --- END NEW CODE HERE ---
