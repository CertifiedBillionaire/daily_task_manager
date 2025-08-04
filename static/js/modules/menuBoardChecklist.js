// --- REPLACE THE ENTIRE FUNCTION WITH THIS ---

function getMenuBoardChecklistHTML() {
    return `
        <div class="checklist-container">
            <div class="checklist-header">Menu Board Inspection</div>
            <div class="checklist-item">
                <input type="checkbox" id="menu-board-power-cb">
                <label for="menu-board-power-cb">All boards are ON and lights are functional.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="menu-board-content-cb">
                <label for="menu-board-content-cb">Screen content is correct and not frozen.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="menu-board-facility-cb">
                <label for="menu-board-facility-cb">No damage to surrounding borders or walls.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="menu-board-promo-cb">
                <label for="menu-board-promo-cb">Promotional toppers & signs are current.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="menu-board-issue-cb" class="issue-checkbox">
                <label for="menu-board-issue-cb">Report an issue</label>
            </div>
            <div class="notes-section">
                <label for="menu-board-notes">Notes:</label>
                <textarea id="menu-board-notes" rows="4" placeholder="e.g., paint chipped on wall above salad bar"></textarea>
            </div>
        </div>
    `;
}

// Make the function available to other modules
export { getMenuBoardChecklistHTML };