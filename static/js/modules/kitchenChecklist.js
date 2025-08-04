// --- NEW CODE HERE ---

function getKitchenChecklistHTML() {
    return `
        <div class="checklist-container">
            <div class="checklist-header">Kitchen Equipment Inspection</div>
            <div class="checklist-item">
                <input type="checkbox" id="kitchen-operational-cb">
                <label for="kitchen-operational-cb">All kitchen equipment is operational.</label>
            </div>
            <div class="notes-section">
                <label for="kitchen-notes">Notes (document any issues):</label>
                <textarea id="kitchen-notes" rows="4" placeholder="e.g., Pizza oven #2 not reaching temperature"></textarea>
            </div>
        </div>
    `;
}

// Make the function available to other modules
export { getKitchenChecklistHTML };


// --- END NEW CODE ---