function getGameRoomChecklistHTML() {
    return `
        <div class="checklist-container">
            <div class="checklist-header">Game Room Inspection</div>
            <p class="checklist-subtitle">Verify the quality of the previous night's closing.</p>
            <div class="checklist-item">
                <input type="checkbox" id="gameroom-floors-cb">
                <label for="gameroom-floors-cb">Floors are clean and free of debris.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="gameroom-games-cb">
                <label for="gameroom-games-cb">Games are wiped down (not dusty).</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="gameroom-gametrash-cb">
                <label for="gameroom-gametrash-cb">Area around games is clean (no trash).</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="gameroom-booths-cb">
                <label for="gameroom-booths-cb">Tables and booths are wiped and clean.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="gameroom-issue-cb" class="issue-checkbox">
                <label for="gameroom-issue-cb">Report a closing issue</label>
            </div>
            <div class="notes-section">
                <label for="gameroom-notes">Notes (document any specific issues):</label>
                <textarea id="gameroom-notes" rows="4" placeholder="e.g., Booth 3 was not wiped down"></textarea>
            </div>
        </div>
    `;
}

// Make the function available to other modules
export { getGameRoomChecklistHTML };