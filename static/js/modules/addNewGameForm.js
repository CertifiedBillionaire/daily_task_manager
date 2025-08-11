// --- ENTIRE FILE REPLACEMENT ---
// addNewGameForm.js
// Handles the "Add Game" compact dropdown form on the Inventory page.

import { renderGamesTable } from './gamesTableRenderer.js';

export function initAddNewGameForm() {
  console.log("📌 initAddNewGameForm()");

  // Elements
  const addBtn          = document.getElementById('addGameButton');
  const nameInput       = document.getElementById('gameNameInput');
  const statusSelect    = document.getElementById('gameStatusSelect');
  const downReasonInput = document.getElementById('gameDownReason');
  const reasonGroup     = document.getElementById('downReasonGroup');
  const dropdownPanel   = document.getElementById('addGameDropdown');
  const toggleBtn       = document.getElementById('addGameToggleBtn');

  // Safety check
  if (!addBtn || !nameInput || !statusSelect) {
    console.error("❌ addNewGameForm: form elements not found");
    return;
  }

  // --- NEW CODE HERE ---
  // Minimal toast helper (no CSS file needed). Uses #toast-container from base.html.
  function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    // Make sure it’s positioned nicely (inline styles so it works without CSS)
    Object.assign(c.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: '9999',
      pointerEvents: 'none'
    });
    return c;
  }

  function showToast(message, type = 'success') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');

    // colors per type
    const bg = (type === 'error') ? '#991b1b' : (type === 'info') ? '#1f2937' : '#065f46';
    const shadow = '0 8px 24px rgba(0,0,0,.18)';

    Object.assign(toast.style, {
      background: bg,
      color: '#fff',
      padding: '10px 12px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: shadow,
      opacity: '0',
      transform: 'translateY(6px)',
      transition: 'opacity .15s ease, transform .15s ease',
      pointerEvents: 'auto'
    });
    toast.textContent = message;
    container.appendChild(toast);

    // animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // auto remove after 2.2s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => container.removeChild(toast), 200);
    }, 2200);
  }
  // --- END NEW CODE HERE ---

  // Helpers
  const safeJson = async (res) => { try { return await res.json(); } catch { return {}; } };

  const showReason = () => {
    if (!reasonGroup) return;
    const show = statusSelect.value === 'Down';
    reasonGroup.style.display = show ? 'block' : 'none';
    if (!show && downReasonInput) downReasonInput.value = '';
  };

  const setBusy = (btn, busy) => {
    if (!btn) return;
    if (busy) {
      btn.disabled = true;
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding…';
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };

  const closeDropdown = () => {
    if (dropdownPanel) dropdownPanel.style.display = 'none';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  };

  const clearForm = () => {
    nameInput.value = '';
    statusSelect.value = 'Up';
    if (downReasonInput) downReasonInput.value = '';
    showReason();
  };

  // Submit handler
  const submit = async () => {
    const name = nameInput.value.trim();
    const status = statusSelect.value;
    const down_reason = (status === 'Down' && downReasonInput) ? downReasonInput.value.trim() : null;

    if (!name) {
      alert("Please enter a game name.");
      nameInput.focus();
      return;
    }

    try {
      setBusy(addBtn, true);

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, status, down_reason })
      });

      if (!res.ok) {
        const err = await safeJson(res);
        showToast(`Error: ${err.error || res.statusText}`, 'error');
        return;
      }

      // Success → clear + close + refresh + toast
      clearForm();
      closeDropdown();
      await renderGamesTable();
      showToast('Game added!', 'success');

    } catch (err) {
      console.error("❌ Failed to add game:", err);
      showToast('Failed to add game.', 'error');
    } finally {
      setBusy(addBtn, false);
    }
  };

  // Wire events
  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submit();
  });

  // Enter key inside dropdown submits
  if (dropdownPanel) {
    dropdownPanel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }

  // Reason show/hide on Status change + initial state
  statusSelect.addEventListener('change', showReason);
  showReason();
}
// --- END ENTIRE FILE REPLACEMENT ---
