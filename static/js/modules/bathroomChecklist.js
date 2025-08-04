// daily_task_manager/static/js/modules/bathroomChecklist.js

// This list contains all the items for the bathroom inspection
export const bathroomChecklistItems = [
    { name: "Toilet Battery", label: "Check toilet battery status." },
    { name: "Sinks", label: "Inspect sinks for issues." },
    { name: "Paint", label: "Check for paint chips or damage." },
    { name: "Locks", label: "Verify locks are working correctly." },
    { name: "Hardware", label: "Inspect hardware is secure (e.g., toilet paper holders)." },
];


/**
 * This function creates the HTML for the Bathroom Checklist.
 * @returns {string} The HTML string for the checklist.
 */
export function createBathroomChecklistHTML() {
    let html = '';
    
    bathroomChecklistItems.forEach(item => {
        const sanitizedName = item.name.replace(/\s/g, '');
        html += `
        <div class="form-group checklist-item">
            <div class="form-checkbox">
                <input type="checkbox" id="bathroom-${sanitizedName}-ok" class="form-checkbox-input">
                <label for="bathroom-${sanitizedName}-ok" class="form-checkbox-label">${item.label}</label>
            </div>
            <textarea id="bathroom-${sanitizedName}-notes" class="form-textarea" placeholder="Add notes if an issue was found..."></textarea>
        </div>
        `;
    });

    return html;
}