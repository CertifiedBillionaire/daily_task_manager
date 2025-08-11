// =========================================================================
// ARCADE MANAGER - DASHBOARD QUICK ADD ISSUE
// Opens a small modal from the "Log a New Issue" card and posts to /api/issues.
//
// What this file does:
// - Click the card (#addNewIssueCard) OR the (+) FAB -> open modal (#addIssueModal)
// - Submit form -> POST /api/issues with required fields (description, priority, status="Open")
// - Optional fields: area, equipment_location, notes
// - On success: show green notice, clear form, refresh the Issues card counts
//
// Connected files:
// - templates/index.html (modal markup + links + #addIssueFab)
// - dashboardIssuesCard.js (to refresh Open/Awaiting counts)
// - Backend: POST /api/issues
//
// Exports:
// - initIssuesQuickAdd()
// =========================================================================

import { initIssuesCard } from './dashboardIssuesCard.js';

const $ = (q, root = document) => root.querySelector(q);

/* ---------- modal helpers ---------- */
function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  const first = $('#ai-desc', modal);
  first && first.focus();
  document.addEventListener('keydown', onEsc, true);
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  document.removeEventListener('keydown', onEsc, true);
}

function onEsc(e) {
  if (e.key === 'Escape') closeModal($('#addIssueModal'));
}

/* ---------- ui helpers ---------- */
function setBusy(btn, busy) {
  if (!btn) return;
  if (busy) {
    btn.disabled = true;
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding…';
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

function toast(text, type = 'success') {
  const modal = $('#addIssueModal');
  const panel = $('.simple-modal__panel', modal);
  const body = $('.simple-modal__body', modal);
  if (!panel || !body) return;

  let t = $('.ai-toast', modal);
  if (!t) {
    t = document.createElement('div');
    t.className = 'ai-toast';
    panel.insertBefore(t, body);
  }
  t.textContent = text;
  t.classList.toggle('is-error', type === 'error');
  t.style.opacity = '1';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => (t.style.opacity = '0'), 2000);
}

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

/* ---------- submit ---------- */
async function submitIssue(e) {
  e.preventDefault();
  const btn = $('#ai-submit');
  const desc = $('#ai-desc').value.trim();
  const priority = $('#ai-priority').value || 'Medium';
  const area = $('#ai-area').value.trim();
  const equipment_location = $('#ai-equip').value.trim();
  const notes = $('#ai-notes').value.trim();

  if (!desc) {
    alert('Please enter a description.');
    $('#ai-desc').focus();
    return;
  }

  try {
    setBusy(btn, true);
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: desc,
        priority,
        status: 'Open',
        area: area || '',
        equipment_location: equipment_location || '',
        notes: notes || ''
      })
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.error || res.statusText);
    }

    // success: clear form + toast + refresh counts
    $('#ai-form').reset();
    toast('Issue added!', 'success');
    await initIssuesCard();
  } catch (err) {
    console.error('QuickAdd Issue failed:', err);
    toast('Failed to add issue.', 'error');
    alert('Failed to add issue. See console for details.');
  } finally {
    setBusy(btn, false);
  }
}

/* ---------- init ---------- */
export function initIssuesQuickAdd() {
  const card  = $('#addNewIssueCard');
  const modal = $('#addIssueModal');
  const form  = $('#ai-form');
  const fab   = $('#addIssueFab');

  if (!card || !modal || !form) return;

  // open by clicking the whole card
  card.addEventListener('click', () => openModal(modal));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(modal);
    }
  });

  // floating (+) button opens the same modal
  if (fab) {
    fab.addEventListener('click', (e) => {
      e.stopPropagation(); // don’t bubble to card
      openModal(modal);
    });
  }

  // close on overlay or X
  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal(modal);
  });

  // submit form
  form.addEventListener('submit', submitIssue);
}

/* auto-init */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIssuesQuickAdd);
} else {
  initIssuesQuickAdd();
}