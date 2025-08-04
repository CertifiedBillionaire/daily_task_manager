// --- NEW CODE HERE ---

function getKioskChecklistHTML() {
    return `
        <div class="checklist-container">
            <div class="checklist-header">Kiosk Inspection</div>
            <div class="checklist-item">
                <input type="checkbox" id="kiosk-power-cb">
                <label for="kiosk-power-cb">All kiosks are powered ON.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="kiosk-screen-cb">
                <label for="kiosk-screen-cb">Touch screens are clean and responsive.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="kiosk-reader-cb">
                <label for="kiosk-reader-cb">Card readers are functional.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="kiosk-printer-cb">
                <label for="kiosk-printer-cb">Receipt printers have paper and are working.</label>
            </div>
            <div class="checklist-item">
                <input type="checkbox" id="kiosk-issue-cb" class="issue-checkbox">
                <label for="kiosk-issue-cb">Report an issue</label>
            </div>
            <div class="notes-section">
                <label for="kiosk-notes">Notes:</label>
                <textarea id="kiosk-notes" rows="4" placeholder="e.g., Kiosk 3 card reader is slow"></textarea>
            </div>
        </div>
    `;
}

// Make the function available to other modules
export { getKioskChecklistHTML };

// --- END NEW CODE ---