// --- NEW CODE HERE ---
// gamesTableRenderer.js
// Handles fetching and rendering the Game Inventory table

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
                    </tr>
                </thead>
                <tbody>
        `;

        if (games.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center;">No games found</td></tr>`;
        } else {
            for (const game of games) {
                const paddedId = String(game.id).padStart(3, '0');
                html += `
                    <tr>
                        <td>${paddedId}</td>
                        <td>${game.name}</td>
                        <td>${game.status}</td>
                        <td>${game.down_reason || ''}</td>
                        <td>${game.updated_at || ''}</td>
                    </tr>
                `;
            }
        }

        html += `</tbody></table>`;
        container.innerHTML = html;

        // --- NEW CODE HERE ---
        // Update summary counters AFTER we render
        const upCountEl = document.getElementById('games-up-count');
        const downCountEl = document.getElementById('games-down-count');
        if (upCountEl && downCountEl) {
            const upCount = games.filter(g => g.status === 'Up').length;
            const downCount = games.filter(g => g.status === 'Down').length;
            upCountEl.textContent = upCount;
            downCountEl.textContent = downCount;
        }
        // --- END NEW CODE HERE ---

    } catch (err) {
        console.error("❌ Failed to load games:", err);
        container.innerHTML = `<p style="color:red;">Error loading games</p>`;
    }
}
// --- END NEW CODE HERE ---
