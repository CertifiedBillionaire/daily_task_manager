// --- NEW CODE HERE ---
// gameInlineEditor.js
// Turns a game row into an inline editor with Save/Cancel.

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
            <input type="text" class="gie-reason" placeholder="Reason if Down" value="${escapeHtml(reasonVal)}" style="width:100%; ${status === 'Down' ? '' : 'display:none;'}">
        </td>
        <td><!-- Last Updated will refresh after save --></td>
        <td>
            <button class="gie-save" style="margin-right:8px;"><i class="fas fa-check"></i> Save</button>
            <button class="gie-cancel"><i class="fas fa-times"></i> Cancel</button>
        </td>
    `;
    // Autofocus the Name input and select its text
    const nameInput = rowEl.querySelector('.gie-name');
    if (nameInput) {
        nameInput.focus();
        // Put cursor at end (and select all if you want to overtype)
        const val = nameInput.value;
        nameInput.setSelectionRange(val.length, val.length);
        // If you prefer select-all instead, use:
        // nameInput.select();
    }

    // Show/hide reason based on status select
    const statusSel = rowEl.querySelector('.gie-status');
    const reasonInput = rowEl.querySelector('.gie-reason');
    statusSel.addEventListener('change', () => {
        reasonInput.style.display = statusSel.value === 'Down' ? '' : 'none';
        if (statusSel.value !== 'Down') reasonInput.value = '';
    });

    // Save
    rowEl.querySelector('.gie-save').addEventListener('click', async () => {
        const newName = rowEl.querySelector('.gie-name').value.trim();
        const newStatus = statusSel.value;
        const newReason = (newStatus === 'Down') ? reasonInput.value.trim() : null;

        if (!newName) {
            alert('Please enter a game name.');
            return;
        }

        try {
            const res = await fetch(`/api/games/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    status: newStatus,
                    down_reason: newReason
                })
            });
            if (!res.ok) {
                const err = await safeJson(res);
                alert(`Error saving game: ${err.error || res.statusText}`);
                return;
            }
            // Re-render table & counters
            await renderGamesTable();
        } catch (e) {
            console.error('❌ Save failed:', e);
            alert('Save failed. See console for details.');
        }
    });

    // Cancel -> re-render full table (simple + safe)
    rowEl.querySelector('.gie-cancel').addEventListener('click', async () => {
        await renderGamesTable();
    });

    // Keyboard shortcuts: Enter = Save, Esc = Cancel
    rowEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            rowEl.querySelector('.gie-save').click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            rowEl.querySelector('.gie-cancel').click();
        }
    });

    rowEl.querySelector('.gie-cancel').addEventListener('click', async () => {
        await renderGamesTable();
    });
}

// small helpers
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
