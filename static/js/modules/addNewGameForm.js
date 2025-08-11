// --- NEW CODE HERE ---
// addNewGameForm.js
// Handles the "Add Game" form submission for the Game Inventory page

import { renderGamesTable } from './gamesTableRenderer.js';

export function initAddNewGameForm() {
    console.log("📌 initAddNewGameForm() running");
    const addBtn = document.getElementById('addGameButton');
    const nameInput = document.getElementById('gameNameInput');
    const statusSelect = document.getElementById('gameStatusSelect');
    const downReasonInput = document.getElementById('gameDownReason');

    if (!addBtn || !nameInput || !statusSelect) {
        console.error("❌ addNewGameForm: form elements not found");
        return;
    }

    addBtn.addEventListener('click', async (e) => {
        console.log("📌 Add Game button clicked");
        e.preventDefault();

        const name = nameInput.value.trim();
        const status = statusSelect.value;
        const downReason = (status === 'Down') ? downReasonInput.value.trim() : null;

        if (!name) {
            alert("Please enter a game name.");
            return;
        }

        try {
            const res = await fetch('/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, status, down_reason: downReason })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(`Error adding game: ${err.error || res.statusText}`);
                return;
            }

            // Clear inputs
            nameInput.value = '';
            statusSelect.value = 'Up';
            downReasonInput.value = '';
            document.getElementById('downReasonGroup').style.display = 'none';

            // Refresh table
            await renderGamesTable();
        } catch (err) {
            console.error("❌ Failed to add game:", err);
            alert("Failed to add game. See console for details.");
        }
    });
}
// --- END NEW CODE HERE ---
