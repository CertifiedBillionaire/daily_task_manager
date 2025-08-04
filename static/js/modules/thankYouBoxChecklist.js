// --- NEW CODE HERE ---

function getThankYouBoxChecklistHTML() {
    return `
        <div class="checklist-container">
            <div class="checklist-header">Thank You Box Inspection</div>
            <div class="checklist-item">
                <input type="checkbox" id="box-stocked-cb">
                <label for="box-stocked-cb">All boxes are properly stocked.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="box-items-ok-cb">
                <label for="box-items-ok-cb">No missing or damaged items.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="box-locked-cb">
                <label for="box-locked-cb">All box doors are securely locked.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="box-issue-cb" class="issue-checkbox">
                <label for="box-issue-cb">Report an issue</label>
            </div>
            <div class="notes-section">
                <label for="box-notes">Notes:</label>
                <textarea id="box-notes" rows="4" placeholder="e.g., Box near restroom is low on stock"></textarea>
            </div>
        </div>
    `;
}

// Make the function available to other modules
export { getThankYouBoxChecklistHTML };

// --- END NEW CODE ---