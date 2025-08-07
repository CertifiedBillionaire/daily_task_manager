// --- NEW FILE: issueOptions.js ---
// This file is a module that exports a function to initialize the options menu.

export function initIssueOptions() {
    const issuesTableBody = document.getElementById('issuesTableBody');
    if (!issuesTableBody) return; // Make sure the element exists on the page
    console.log("initIssueOptions function is running!");


    issuesTableBody.addEventListener('click', (event) => {
        const button = event.target.closest('.row-options-button');
        if (button) {
            // Prevent the click from bubbling up and closing the menu
            event.stopPropagation();
            
            const menuContainer = button.closest('.options-menu-container');
            const menu = menuContainer.querySelector('.options-menu');

            // Close any other open menus
            document.querySelectorAll('.options-menu.active').forEach(openMenu => {
                if (openMenu !== menu) {
                    openMenu.classList.remove('active');
                }
            });

            // Toggle the 'active' class on the clicked menu
            menu.classList.toggle('active');
        }
    });

    // Close the menu if the user clicks anywhere else on the page
    document.addEventListener('click', (event) => {
        document.querySelectorAll('.options-menu.active').forEach(openMenu => {
            openMenu.classList.remove('active');
        });
    });
}