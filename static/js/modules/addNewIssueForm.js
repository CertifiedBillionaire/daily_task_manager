// =========================================================================
// ARCADE MANAGER - ADD NEW ISSUE FORM MODULE
// This module handles the collapsible behavior and submission logic
// for the "Add New Issue" form on the Issues Management page.
// =========================================================================

/**
 * Sets up collapsible behavior for a given header and its content.
 * This is a reusable utility function.
 * @param {string} headerId The ID of the clickable header element.
 * @param {string} contentClass The class name of the collapsible content element.
 */
function setupCollapsible(headerId, contentClass) {
    const header = document.getElementById(headerId);
    if (header) {
        // Find the content div immediately following the header
        const content = header.nextElementSibling; 
        if (content && content.classList.contains(contentClass)) {
            header.addEventListener('click', () => {
                header.classList.toggle('active');
                content.classList.toggle('active');
            });
        } else {
            console.warn(`Collapsible setup: Content element with class '${contentClass}' not found after header '${headerId}'.`);
        }
    } else {
        console.warn(`Collapsible setup: Header element with ID '${headerId}' not found.`);
    }
}

/**
 * Initializes the "Add New Issue" form's collapsible behavior and submission logic.
 * This function should be called when the Issues Management page is loaded.
 */
export function initAddNewIssueForm() {
    // Setup the collapsible behavior for the "Add New Issue" section
    setupCollapsible('addNewIssueToggle', 'collapsible-content');
    console.log("Add New Issue form collapsible behavior initialized.");

    // --- NEW CODE HERE ---
    const addNewIssueForm = document.getElementById('addNewIssueForm');
    const newIssueEquipmentLocation = document.getElementById('newIssueEquipmentLocation');
    const newIssueDescription = document.getElementById('newIssueDescription');
    const newIssueArea = document.getElementById('newIssueArea');
    const newIssueCategory = document.getElementById('newIssueCategory');
    const newIssuePriority = document.getElementById('newIssuePriority');
    const newIssueAssignedTo = document.getElementById('newIssueAssignedTo');

    if (addNewIssueForm) {
        addNewIssueForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission (page reload)

            // Collect form data
            const issueData = {
                equipment_location: newIssueEquipmentLocation.value.trim(),
                description: newIssueDescription.value.trim(),
                area: newIssueArea.value,
                category: newIssueCategory.value, // This is for frontend logic, not directly sent to DB yet
                priority: newIssuePriority.value,
                assigned_to: newIssueAssignedTo.value.trim(),
                status: "Open" // Default status for new issues
            };

            // Basic client-side validation
            if (!issueData.description || !issueData.priority || !issueData.area || !issueData.equipment_location) {
                window.showToast("Please fill in all required fields (Description, Priority, Area, Equipment/Location).", "Error", 5000);
                console.warn("Form submission failed: Missing required fields.");
                return;
            }

            // --- Smart Priority Setting based on Category (Frontend Logic) ---
            // This replicates some of your old Google Sheets logic
            if (issueData.category === "Safety") {
                issueData.priority = "IMMEDIATE";
                console.log("Priority auto-set to IMMEDIATE due to Safety category.");
            } else if (issueData.category === "Cleaning") {
                issueData.priority = "CLEANING";
                console.log("Priority auto-set to CLEANING due to Cleaning category.");
            }
            // You can add more rules here (e.g., Cosmetic -> Low)

            try {
                const response = await fetch('/api/issues', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(issueData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                window.showToast(`Issue ${result.issue_id} added successfully!`, "Success", 3000);
                console.log("Issue submitted successfully:", result);

                // Clear the form fields after successful submission
                addNewIssueForm.reset();
                newIssuePriority.value = ""; // Reset priority dropdown specifically if it was auto-set
                newIssueArea.value = "";
                newIssueCategory.value = "";
                newIssueAssignedTo.value = "";

                // --- Future Step: Refresh the issues table here ---
                // You will call a function from issuesTable.js here to re-render the table.

            } catch (error) {
                window.showToast(`Error adding issue: ${error.message}`, "Error", 5000);
                console.error("Error submitting new issue:", error);
            }
        });

        // Optional: Add a listener for Category change to auto-set Priority on the form itself
        newIssueCategory.addEventListener('change', () => {
            const selectedCategory = newIssueCategory.value;
            if (selectedCategory === "Safety") {
                newIssuePriority.value = "IMMEDIATE";
            } else if (selectedCategory === "Cleaning") {
                newIssuePriority.value = "CLEANING";
            } else {
                // Optionally reset to default or keep current selection if no specific rule applies
                // newIssuePriority.value = ""; 
            }
        });

    } else {
        console.warn("Add New Issue Form: Form element not found.");
    }
    // --- END NEW CODE ---
}
