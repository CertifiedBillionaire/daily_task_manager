// --- NEW CODE HERE ---

function getAdventureZoneChecklistHTML() {
    return `
        <div class="checklist-container">
            <div class="checklist-header">Adventure Zone Inspection</div>
            <div class="checklist-item">
                <input type="checkbox" id="azone-safety-cb">
                <label for="azone-safety-cb">All nets, pads, and structures are secure and undamaged.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="azone-clean-cb">
                <label for="azone-clean-cb">Zone is clean and free of debris.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="azone-lighting-cb">
                <label for="azone-lighting-cb">All lighting is operational.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="azone-issue-cb" class="issue-checkbox">
                <label for="azone-issue-cb">Report an issue</label>
            </div>
            <div class="notes-section">
                <label for="azone-notes">Notes (document any safety, cleaning, or lighting issues):</label>
                <textarea id="azone-notes" rows="4" placeholder="e.g., Torn net near red slide"></textarea>
            </div>
        </div>
    `;
}

// Make the function available to other modules
export { getAdventureZoneChecklistHTML };

// --- END NEW CODE ---