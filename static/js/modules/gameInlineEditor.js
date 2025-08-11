// --- NEW CODE HERE ---
// gameInlineEditor.js
// Turns a game row into an inline editor with Save/Cancel + warnings + shortcuts.

import { renderGamesTable } from './gamesTableRenderer.js';

export function openGameInlineEditor({ rowEl, id, name, status, down_reason }) {
    if (!rowEl) return;

    // Build editor row
    const paddedId = String(id).padStart(3, '0');
    const reasonVal = down_reason || '';

    rowEl.innerHTML = `
        <td>${paddedId}</td>
        <td>
            <input type="text" class="gie-name" value="${escapeHtml(name)}" style="width:100%;">
        </td>
        <td>
            <select class="gie-status" style="width:100%;">
                <option value="Up" ${status === 'Up' ? 'selected' : ''}>Up</option>
                <option value="Down" ${status === 'Down' ? 'selected' : ''}>Down</option>
            </select>
        </td>
        <td>
            <input type="text" class="gie-reason" placeholder="Reason if Down"
                value="${escapeHtml(reasonVal)}"
                style="width:100%; ${status === 'Down' ? '' : 'display:none;'}">
        </td>
        <td><!-- Last Updated will refresh after save --></td>
        <td>
            <button class="gie-save" style="margin-right:8px;"><i class="fas fa-check"></i> Save</button>
            <button class="gie-cancel"><i class="fas fa-times"></i> Cancel</button>
        </td>
    `;

    // refs
    const nameInput   = rowEl.querySelector('.gie-name');
    const statusSel   = rowEl.querySelector('.gie-status');
    const reasonInput = rowEl.querySelector('.gie-reason');

    // Autofocus name (cursor at end)
    if (nameInput) {
        const val = nameInput.value;
        nameInput.focus();
        nameInput.setSelectionRange(val.length, val.length);
    }

    // Track dirty changes
    let isDirty = false;
    [nameInput, statusSel, reasonInput].forEach(el => {
        if (!el) return;
        el.addEventListener('input',  () => { isDirty = true; });
        el.addEventListener('change', () => { isDirty = true; });
    });

    // Show/hide reason based on status
    statusSel.addEventListener('change', () => {
        reasonInput.style.display = statusSel.value === 'Down' ? '' : 'none';
        if (statusSel.value !== 'Down') reasonInput.value = '';
    });

    // Warn on page leave with unsaved changes
    function beforeUnloadHandler(e) {
        if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // Click-away guard (asks to discard)
    function onDocumentClick(e) {
        if (rowEl.contains(e.target)) return; // clicked inside editor
        if (isDirty) {
            const ok = confirm('Discard changes?');
            if (!ok) { e.stopPropagation(); e.preventDefault(); return; }
        }
        cleanupAndRestore();
    }
    document.addEventListener('click', onDocumentClick, true);

    // Keyboard shortcuts
    rowEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); rowEl.querySelector('.gie-save').click(); }
        else if (e.key === 'Escape') { e.preventDefault(); rowEl.querySelector('.gie-cancel').click(); }
    });

    // Save
    rowEl.querySelector('.gie-save').addEventListener('click', async () => {
        const newName   = nameInput.value.trim();
        const newStatus = statusSel.value;
        const newReason = (newStatus === 'Down') ? (reasonInput.value.trim()) : null;

        if (!newName) { alert('Please enter a game name.'); return; }

        try {
            const res = await fetch(`/api/games/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, status: newStatus, down_reason: newReason })
            });
            if (!res.ok) {
                const err = await safeJson(res);
                alert(`Error saving game: ${err.error || res.statusText}`);
                return;
            }
            isDirty = false;
            cleanupAndRestore();
        } catch (e) {
            console.error('❌ Save failed:', e);
            alert('Save failed. See console for details.');
        }
    });

    // Cancel
    rowEl.querySelector('.gie-cancel').addEventListener('click', () => {
        isDirty = false;
        cleanupAndRestore();
    });

    // one cleanup to rule them all
    function cleanupAndRestore() {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        document.removeEventListener('click', onDocumentClick, true);
        renderGamesTable();
    }
}

// helpers
function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => (
        { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
}

async function safeJson(res) {
    try { return await res.json(); }
    catch { return {}; }
}
// --- END NEW CODE HERE ---
