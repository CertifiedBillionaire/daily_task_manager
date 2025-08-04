// daily_task_manager/static/js/modules/safetySecurityChecklist.js

// This list contains all the items for the safety and security checklist
export const safetyChecklistItems = [
    { name: "Alarms & Locks", label: "Verify alarms and locks are secure." },
    { name: "Lighting", label: "Inspect all lighting for dark spots or issues." },
    { name: "Carpets & Tiles", label: "Inspect carpets and tiles for tears or broken areas." },
    { name: "Tables & Chairs", label: "Check all tables and chairs for stability and missing hardware." },
];


/**
 * This function creates the HTML for the Safety & Security Checklist.
 * @returns {string} The HTML string for the checklist.
 */
export function createSafetyChecklistHTML() {
    let html = '';
    
    safetyChecklistItems.forEach(item => {
        html += `
        <div class="form-group checklist-item">
            <div class="form-checkbox">
                <input type="checkbox" id="safety-${item.name.replace(/\s/g, '')}-ok" class="form-checkbox-input">
                <label for="safety-${item.name.replace(/\s/g, '')}-ok" class="form-checkbox-label">${item.label}</label>
            </div>
            <textarea id="safety-${item.name.replace(/\s/g, '')}-notes" class="form-textarea" placeholder="Add notes if an issue was found..."></textarea>
        </div>
        `;
    });

    return html;
}