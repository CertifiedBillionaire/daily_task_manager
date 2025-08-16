// static/js/pages/issueHubForm.js
// Binds the New Issue form exactly once, guards against double-submits,
// handles 409 duplicate flow, and refreshes the table.

export function initIssueHubForm({ onAdded = () => {}, refreshFn = () => {} } = {}) {
  const form = document.getElementById('newIssueForm');
  if (!form) return;

  // Prevent multiple bindings across hot reloads / multiple script tags
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  const submitBtn = form.querySelector('button[type="submit"]');

  async function postCreate(payload) {
    const res = await fetch('/api/issuehub/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.busy === '1') return;         // double-click guard
    form.dataset.busy = '1';
    submitBtn?.setAttribute('disabled', '');
    submitBtn?.classList.add('is-loading');

    const payload = {
      title:       (document.getElementById('problemDescriptionInput')?.value || '').trim(),
      priority:     document.getElementById('priorityInput')?.value || 'medium',
      status:       document.getElementById('newStatusInput')?.value || 'open',
      category:     document.getElementById('categoryInput')?.value || 'gameroom',
      location:    (document.getElementById('equipmentNameInput')?.value || '').trim(),
      notes:       (document.getElementById('notesInput')?.value || '').trim(),
      target_date:  document.getElementById('targetDateInput')?.value || null,
      assignee:    (document.getElementById('assignedEmployeeInput')?.value || '').trim(),
    };

    // basic required validation
    if (!payload.title) {
      (window.showToast ?? alert)('Problem Description is required');
      submitBtn?.classList.remove('is-loading');
      submitBtn?.removeAttribute('disabled');
      form.dataset.busy = '0';
      return;
    }

    try {
      // First try (no override)
      let { res, body } = await postCreate(payload);

      // If duplicate, confirm and retry with override
      if (res.status === 409 && body?.error === 'duplicate_issue') {
        const confirmMsg = `Similar issue already open (ID: ${body.existing_id}). Add anyway?`;
        if (!confirm(confirmMsg)) {
          (window.showToast ?? alert)('Not added (duplicate)');
          return;
        }
        ({ res, body } = await postCreate({ ...payload, allow_duplicate: true }));
      }

      if (!res.ok) {
        throw new Error(body?.error || 'Add failed');
      }

      // success UX
      (window.showToast ?? alert)(`Issue ${body?.id ?? ''} added`);
      form.reset();

      // re-apply default category value the form expects (hidden input)
      const cat = document.getElementById('categoryInput');
      if (cat && !cat.value) cat.value = 'gameroom';

      // optional: remember last assignee
      try {
        if (payload.assignee) localStorage.setItem('last_assignee', payload.assignee);
      } catch {}

      // notify / refresh UI
      try { onAdded(body); } catch {}
      try { (window.refreshIssuesTableData || refreshFn)(); } catch {}
    } catch (err) {
      console.error(err);
      (window.showToast ?? alert)(err.message || 'Network error while adding issue.');
    } finally {
      submitBtn?.classList.remove('is-loading');
      submitBtn?.removeAttribute('disabled');
      form.dataset.busy = '0';
    }
  });
}

// Auto-init when loaded as a module directly
document.addEventListener('DOMContentLoaded', () => {
  try {
    initIssueHubForm({
      onAdded: (issue) => console.log('Added issue:', issue),
      refreshFn: window.refreshIssuesTableData ?? (() => {})
    });
  } catch {}
});
