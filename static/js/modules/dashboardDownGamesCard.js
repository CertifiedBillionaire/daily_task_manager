// =========================================================================
// ARCADE MANAGER - DASHBOARD DOWN GAMES CARD
// Loads real-time Down count and Uptime % into the “Update Down Games” card.
//
// What this file does:
// - GET /api/games
// - Count how many are Down
// - Compute uptime = Up / Total (%)
// - Update #downGamesCount and #downGamesUptime
//
// Connected files:
// - templates/index.html  (the card markup + this module import)
// - static/css/components/cards.css (metric styles)
// - Backend endpoint: GET /api/games
//
// Exports:
// - initDownGamesCard()
// =========================================================================

export async function initDownGamesCard() {
  const card = document.getElementById('downGamesCard');
  const countEl = document.getElementById('downGamesCount');
  const uptimeEl = document.getElementById('downGamesUptime');

  if (!card || !countEl || !uptimeEl) return; // not on this page

  try {
    const res = await fetch('/api/games');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const games = await res.json();

    const total = games.length;
    const upCount = games.filter(g => g.status === 'Up').length;
    const downCount = total - upCount;
    const uptime = total > 0 ? Math.round((upCount / total) * 100) : 100;

    countEl.textContent = String(downCount);
    uptimeEl.textContent = `${uptime}%`;

    // helpful screen-reader label
    card.setAttribute('aria-label', `Update Down Games. Down: ${downCount}. Uptime: ${uptime} percent.`);
  } catch (err) {
    console.error('❌ DownGamesCard: failed to load games', err);
    countEl.textContent = '—';
    uptimeEl.textContent = '--%';
    card.setAttribute('aria-label', 'Update Down Games. Data unavailable.');
  }
}

// Auto-init if imported directly via <script type="module" src="...">
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDownGamesCard);
} else {
  initDownGamesCard();
}
