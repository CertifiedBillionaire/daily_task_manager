// --- NEW CODE HERE ---
// ARCADE MANAGER - Issues Toolbar Toggle (simple + safe)

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('issuesToolbarToggle');
  const container = document.getElementById('issuesToolbarCompact');

  if (!toggle || !container) return; // if not found, do nothing

  toggle.addEventListener('click', () => {
    container.classList.toggle('active'); // this triggers your CSS to expand/collapse
  });
});
// --- END NEW CODE ---
