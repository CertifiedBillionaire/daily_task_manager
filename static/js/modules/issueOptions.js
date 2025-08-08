/* --- ENTIRE FILE REPLACEMENT --- */

// This function will be called from app.js to set up the menu functionality
export function initIssueOptions() {
    console.log("Light Switch 1: initIssueOptions has been called!");

    const tableBody = document.querySelector('tbody');

    // Add a single event listener to the table body (event delegation)
    // This is more efficient than adding a listener to every single button.
    tableBody.addEventListener('click', (event) => {
        console.log("Light Switch 2: A click was detected inside the table!");

        const button = event.target.closest('.issue-options-button');
        const menuItem = event.target.closest('.menu-item');


        // Check if the click was on a 3-dot button
        if (button) {
            // Find the menu associated with this specific button
            const menu = button.nextElementSibling;

            // Close any other open menus
            document.querySelectorAll('.issue-options-menu:not(.hidden)').forEach(openMenu => {
                // If it's not the menu we just clicked, close it
                if (openMenu !== menu) {
                    openMenu.classList.add('hidden');
                }
            });

            // Toggle the visibility of the clicked menu
            menu.classList.toggle('hidden');
        } 
        
        // Check if the click was on a menu item
        else if (menuItem) {
            // Get the action and the issue ID from the parent row
            const action = menuItem.dataset.action;
            const row = menuItem.closest('tr');
            const issueId = row.querySelector('td:first-child').textContent;
            
            // Call the function to handle the menu action
            handleMenuAction(action, issueId, row);
            
            // Hide the menu after an action is selected
            menuItem.closest('.issue-options-menu').classList.add('hidden');
        } 
        
        // If the click was anywhere else in the table, close any open menus
        else {
             document.querySelectorAll('.issue-options-menu:not(.hidden)').forEach(openMenu => {
                openMenu.classList.add('hidden');
            });
        }
    });

    // Close any open menus when clicking anywhere on the document (outside the table)
    document.addEventListener('click', (event) => {
        const isClickInsideTable = tableBody.contains(event.target);
        if (!isClickInsideTable) {
            document.querySelectorAll('.issue-options-menu:not(.hidden)').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });
}

// This function will contain the logic for what each menu item does.
// This is where you can add code to send requests to your Flask backend.
function handleMenuAction(action, issueId, row) {
    // This is an example of what kind of menu items could go here
    switch (action) {
        case 'edit':
            console.log(`Action: Edit issue ${issueId}`);
            // Example: Open a modal with the issue details for editing
            break;
        case 'mark-resolved':
            console.log(`Action: Mark issue ${issueId} as resolved`);
            // Example: Update the 'Status' cell in the row to 'Resolved'
            // You would also send an API request to update the backend/issues.json
            break;
        case 'assign-employee':
            console.log(`Action: Assign employee to issue ${issueId}`);
            // Example: Open a dropdown or modal to select an employee
            break;
        case 'delete':
            console.log(`Action: Delete issue ${issueId}`);
            // Example: Confirm deletion and then remove the row from the table
            if (confirm(`Are you sure you want to delete issue ${issueId}?`)) {
                row.remove();
                // You would also send an API request to delete the issue from issues.json
            }
            break;
    }
}
/* --- END ENTIRE FILE REPLACEMENT --- */