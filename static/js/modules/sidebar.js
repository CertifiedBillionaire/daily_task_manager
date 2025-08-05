// A function that we can export and run from app.js
export function initSidebar() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (hamburgerMenu && sidebar && overlay) {
        const openSidebar = () => {
            sidebar.classList.add('sidebar-open');
            overlay.classList.add('active');
        };

        const closeSidebar = () => {
            sidebar.classList.remove('sidebar-open');
            overlay.classList.remove('active');
        };

        hamburgerMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });

        overlay.addEventListener('click', closeSidebar);
        
        // Also close the sidebar if a nav link is clicked
        const navLinks = sidebar.querySelectorAll('.nav-item a');
        navLinks.forEach(link => {
            link.addEventListener('click', closeSidebar);
        });
    }
}