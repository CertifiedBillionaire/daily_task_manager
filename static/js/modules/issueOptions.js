/* --- NEW CODE HERE --- */
// static/js/modules/issueOptions.js

// This function will be called to set up the menu functionality
export function initIssueOptions() {
    const tableBody = document.querySelector('tbody');

    // Add a single event listener to the table body (event delegation)
    // This is more efficient than adding a listener to every single button
    tableBody.addEventListener('click', (event) => {
        // Find the closest parent with the class '.issue-options-button'
        const button = event.target.closest('.issue-options-button');

        // Check if the click was on a 3-dot button
        if (button) {
            // Find the menu associated with this button (the next sibling element)
            const menu = button.nextElementSibling;
            
            // Toggle the visibility of the menu by adding or removing the 'hidden' class
            menu.classList.toggle('hidden');
        }
    });

    // Close any open menus when clicking anywhere else on the page
    document.addEventListener('click', (event) => {
        // Find all currently open menus
        const openMenus = document.querySelectorAll('.issue-options-menu:not(.hidden)');
        
        openMenus.forEach(menu => {
            // Check if the click was inside the menu or its button
            const isClickInsideMenu = menu.contains(event.target);
            const isClickInsideButton = menu.previousElementSibling.contains(event.target);

            // If the click was outside both the menu and its button, close the menu
            if (!isClickInsideMenu && !isClickInsideButton) {
                menu.classList.add('hidden');
            }
        });
    });

    // Add event listeners to the menu items to handle actions
    tableBody.addEventListener('click', (event) => {
        // Find the closest parent with the class '.menu-item'
        const menuItem = event.target.closest('.menu-item');

        if (menuItem) {
            // Get the action and the issue ID from the parent row
            const action = menuItem.dataset.action;
            const row = menuItem.closest('tr');
            const issueId = row.querySelector('td:first-child').textContent;
            
            // Call a function based on the action
            handleMenuAction(action, issueId, row);
            
            // Hide the menu after an action is selected
            menuItem.closest('.issue-options-menu').classList.add('hidden');
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
/* --- END NEW CODE --- */