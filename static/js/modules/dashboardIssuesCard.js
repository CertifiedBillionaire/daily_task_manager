// =========================================================================
// ARCADE MANAGER - DASHBOARD ISSUES CARD
// Loads real-time counts into the “Log a New Issue” card.
//
// What this file does:
// - GET /api/issues
// - Count: Open issues (status === "Open")
// - Count: Awaiting Parts (status === "AwaitingPart")
// - Update #issuesOpenCount and #issuesAwaitingPartsCount
//
// Connected files:
// - templates/index.html  (card markup + this module import)
// - static/css/components/cards.css (metric styles)
// - Backend endpoint: GET /api/issues
//
// Exports:
// - initIssuesCard()
// =========================================================================

export async function initIssuesCard() {
  const card = document.getElementById('addNewIssueCard');
  const openEl = document.getElementById('issuesOpenCount');
  const awaitingEl = document.getElementById('issuesAwaitingPartsCount');

  if (!card || !openEl || !awaitingEl) return; // not on this page

  try {
    const res = await fetch('/api/issues');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const issues = await res.json();

    const openCount = issues.filter(i => i.status === 'Open').length;
    const awaitingCount = issues.filter(i => i.status === 'AwaitingPart').length;

    openEl.textContent = String(openCount);
    awaitingEl.textContent = String(awaitingCount);

    card.setAttribute(
      'aria-label',
      `Log a New Issue. Open: ${openCount}. Awaiting Parts: ${awaitingCount}.`
    );
  } catch (err) {
    console.error('❌ IssuesCard: failed to load issues', err);
    openEl.textContent = '—';
    awaitingEl.textContent = '—';
    card.setAttribute('aria-label', 'Log a New Issue. Data unavailable.');
  }
}

// Auto-init if imported directly via <script type="module" …>
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIssuesCard);
} else {
  initIssuesCard();
}