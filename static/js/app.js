// app.js

// --- Global Configuration (Easy to Modify) ---
const APP_TITLE_TEXT = 'Arcade Manager';
const DEFAULT_TPT_TEXT = 'TPT: 1.25'; // This is a fallback default, actual value will be dynamic
const DEFAULT_URGENT_ISSUE_TEXT = 'No Urgent Issues';

// --- Global Task Management Variables ---
// Removed: let dailyTasks = []; // This will hold your tasks
// This variable and its related localStorage functions are now removed,
// as per the previous step's instruction to clean up daily tasks.

// --- Opening Checklist Steps Definition ---
const openingChecklistSteps = [
    { id: 'breakers', text: 'Turn on main breakers and game power.', type: 'boolean' },
    { id: 'check_tpt_reports', text: 'Review TPT Reports: Weekly (Mondays) / Daily (Tue-Fri) to identify runoff or payout anomalies.', type: 'action', actionText: 'View TPT Reports', actionLink: '#' },
    { id: 'form_issue_plan', text: 'Based on TPT and game issues, form today\'s priority workload and plan of action.', type: 'action', actionText: 'Generate Today\'s Plan', actionLink: '#' },
    { id: 'facilities_walkaround', text: 'Perform facilities walk-around for safety/security (doors, alarms, emergency lighting, etc.).', type: 'boolean' },
    { id: 'adventure_zone_walkthrough', text: 'Conduct Adventure Zone walkthrough for safety/security/cleanliness.', type: 'boolean' },
    { id: 'daily_game_tap', text: 'Perform daily game tap checks.', type: 'boolean' },
    { id: 'verify_thank_you_boxes', text: 'Verify "Thank You" boxes are properly stocked and ready for the day.', type: 'boolean' },
    { id: 'set_pms_plan', text: 'Set plan for daily PMs (preventative maintenance for restaurant equipment/show/games).', type: 'action', actionText: 'View PM Schedule', actionLink: '#' },
    { id: 'address_priority_issues', text: 'Get started by addressing priority issues (e.g., down games over PMs).', type: 'action', actionText: 'View Urgent Issues', actionLink: '#' },
    { id: 'district_management_issues', text: 'Address facilities issues needing district management attention (e.g., wall near beverage bar replace and seal).', type: 'action', actionText: 'Log District Issue', actionLink: '#' }
];

// --- Utility Functions (Used across different pages) ---

// Function to update the current date in the header or main content
function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    if (dateElement) {
        dateElement.textContent = today.toLocaleDateString('en-US', options);
    }
    const currentDayDateElement = document.getElementById('currentDayDate');
    if (currentDayDateElement) {
        currentDayDateElement.textContent = today.toLocaleDateString('en-US', options);
    }
}

// --- Custom Modal System (Replaces alert/confirm) ---
const customPopup = document.getElementById('customPopup');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupActions = document.getElementById('popupActions');

/**
 * Shows a custom popup/modal.
 * @param {string} title - The title of the popup.
 * @param {string} message - The message content of the popup.
 * @param {Array<Object>} buttons - Array of button objects { text: 'Button Text', class: 'button-class', action: () => {} }.
 * @param {string} [customContent] - Optional HTML string for custom content inside the popup body.
 */
function showCustomPopup(title, message, buttons = [{ text: 'OK', class: '', action: () => hideCustomPopup() }], customContent = '') {
    if (!customPopup) {
        console.warn("Custom popup elements not found. Using browser alert.");
        alert(`${title}\n\n${message}`);
        return;
    }
    popupTitle.textContent = title;
    if (customContent && popupMessage) {
        popupMessage.innerHTML = message + customContent;
    } else {
        popupMessage.textContent = message;
    }
    popupActions.innerHTML = '';
    buttons.forEach(btn => {
        const buttonElement = document.createElement('button');
        buttonElement.textContent = btn.text;
        buttonElement.classList.add('popup-button');
        if (btn.class) {
            buttonElement.classList.add(btn.class);
        }
        buttonElement.addEventListener('click', () => {
            btn.action();
        });
        popupActions.appendChild(buttonElement);
    });
    customPopup.classList.add('active');
}

function hideCustomPopup() {
    if (customPopup) {
        customPopup.classList.remove('active');
    }
}

// --- Opening Checklist Modal Logic ---
let currentOpeningStepIndex = 0;
let openingChecklistResponses = {};

const openingChecklistModal = document.getElementById('openingChecklistModal');
const checklistModalTitle = document.getElementById('checklistModalTitle');
const checklistStepCounter = document.getElementById('checklistStepCounter');
const checklistStepText = document.getElementById('checklistStepText');
const checklistResponseArea = document.getElementById('checklistResponseArea');
const checklistBackButton = document.getElementById('checklistBackButton');
const checklistNextButton = document.getElementById('checklistNextButton');

function openOpeningChecklistModal() {
    currentOpeningStepIndex = 0;
    openingChecklistResponses = {};
    renderChecklistStep();
    if (openingChecklistModal) {
        openingChecklistModal.classList.add('active');
    }
}

function closeOpeningChecklistModal() {
    if (openingChecklistModal) {
        openingChecklistModal.classList.remove('active');
    }
}

function renderChecklistStep() {
    const currentStep = openingChecklistSteps[currentOpeningStepIndex];
    if (!currentStep) {
        showCustomPopup('Error', 'Checklist step not found.');
        closeOpeningChecklistModal();
        return;
    }

    if (checklistStepCounter) checklistStepCounter.textContent = `Step ${currentOpeningStepIndex + 1} of ${openingChecklistSteps.length}`;
    if (checklistStepText) checklistStepText.textContent = currentStep.text;
    if (checklistResponseArea) checklistResponseArea.innerHTML = '';

    if (currentStep.type === 'boolean') {
        const yesButton = document.createElement('button');
        yesButton.textContent = 'Yes / Done';
        yesButton.classList.add('popup-button', 'checklist-boolean-button');
        if (openingChecklistResponses[currentStep.id] === true) {
            yesButton.classList.add('active-response', 'color-green');
        }
        yesButton.addEventListener('click', () => {
            openingChecklistResponses[currentStep.id] = true;
            renderChecklistStep();
        });
        if (checklistResponseArea) checklistResponseArea.appendChild(yesButton);

        const noButton = document.createElement('button');
        noButton.textContent = 'No / Issue';
        noButton.classList.add('popup-button', 'cancel-button', 'checklist-boolean-button');
        if (openingChecklistResponses[currentStep.id] === false) {
            noButton.classList.add('active-response', 'color-red');
        }
        noButton.addEventListener('click', () => {
            openingChecklistResponses[currentStep.id] = false;
            renderChecklistStep();
        });
        if (checklistResponseArea) checklistResponseArea.appendChild(noButton);

    } else if (currentStep.type === 'action') {
        const actionButton = document.createElement('button');
        actionButton.textContent = currentStep.actionText;
        actionButton.classList.add('popup-button', 'checklist-action-button');
        actionButton.addEventListener('click', () => {
            showCustomPopup('Action Needed', `Navigating to: ${currentStep.actionLink || 'N/A'}. This would open the relevant report/plan area.`);
            openingChecklistResponses[currentStep.id] = 'Action Taken';
        });
        if (checklistResponseArea) checklistResponseArea.appendChild(actionButton);

        const markDoneButton = document.createElement('button');
        markDoneButton.textContent = 'Mark as Done';
        markDoneButton.classList.add('popup-button', 'checklist-boolean-button');
        if (openingChecklistResponses[currentStep.id] === 'Action Taken' || openingChecklistResponses[currentStep.id] === true) {
            markDoneButton.classList.add('active-response', 'color-green');
        }
        markDoneButton.addEventListener('click', () => {
            openingChecklistResponses[currentStep.id] = true;
            renderChecklistStep();
        });
        if (checklistResponseArea) checklistResponseArea.appendChild(markDoneButton);
    }

    if (checklistBackButton) checklistBackButton.disabled = currentOpeningStepIndex === 0;
    if (checklistNextButton) checklistNextButton.textContent = currentOpeningStepIndex === openingChecklistSteps.length - 1 ? 'Finish Checklist' : 'Next Step';
}

if (checklistBackButton) {
    checklistBackButton.addEventListener('click', () => {
        if (currentOpeningStepIndex > 0) {
            currentOpeningStepIndex--;
            renderChecklistStep();
        }
    });
}

if (checklistNextButton) {
    checklistNextButton.addEventListener('click', () => {
        const currentStep = openingChecklistSteps[currentOpeningStepIndex];
        if (currentStep.type === 'boolean' && openingChecklistResponses[currentStep.id] === undefined) {
            showCustomPopup('Missing Response', 'Please select Yes/Done or No/Issue before proceeding.');
            return;
        }
        if (currentStep.type === 'action' && openingChecklistResponses[currentStep.id] === undefined) {
            showCustomPopup('Action Required', 'Please click the action button or Mark as Done before proceeding.');
            return;
        }

        if (currentOpeningStepIndex < openingChecklistSteps.length - 1) {
            currentOpeningStepIndex++;
            renderChecklistStep();
        } else {
            showCustomPopup(
                'Checklist Complete!',
                'You have completed the Daily Opening Checklist. All responses have been recorded.',
                [{ text: 'View Summary', action: () => {
                    console.log('Opening Checklist Responses:', openingChecklistResponses);
                    showCustomPopup('Summary', JSON.stringify(openingChecklistResponses, null, 2), [{text: 'OK', action: hideCustomPopup}]);
                }},
                { text: 'Close', action: closeOpeningChecklistModal }
                ]
            );
        }
    });
}

// --- Page-Specific Initialization Functions (These should be OUTSIDE DOMContentLoaded) ---
function initializeDashboardPage() {
    console.log('Initializing Dashboard Page...');
    const taskListUl = document.querySelector('#daily-tasks-section .task-list');
    const addTaskButton = document.querySelector('#daily-tasks-section .add-task-button');
    let dailyTasks = [];
    function renderTasks() { /* ... */ }
    if (addTaskButton) { /* ... */ }
    const startOpeningChecklistButton = document.querySelector('#startOpeningChecklist .card-action-button');
    if (startOpeningChecklistButton) { startOpeningChecklistButton.addEventListener('click', openOpeningChecklistModal); }
    const dashboardCardButtons = document.querySelectorAll('.dashboard-card.action-card .card-action-button');
    dashboardCardButtons.forEach(button => {
        if (button.closest('.dashboard-card').id !== 'startOpeningChecklist') {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const cardId = this.closest('.dashboard-card').id;
                showCustomPopup('Dashboard Action', `You clicked the button on: ${cardId}`);
            });
        }
    });
}

function initializeGameInventoryPage() {
    console.log('Initializing Game Inventory Page...');
    const gameNameInput = document.getElementById('gameNameInput');
    const gameStatusSelect = document.getElementById('gameStatusSelect');
    const addGameButton = document.getElementById('addGameButton');
    const exportGameListButton = document.getElementById('exportGameListButton');
    const gameListBody = document.getElementById('gameListBody');
    let games = [];
    function renderGameList() { /* ... */ }
    if (addGameButton) { /* ... */ }
    function deleteGame(id) { /* ... */ }
    function editGame(id) { /* ... */ }
    if (exportGameListButton) { /* ... */ }
    renderGameList();
}

function initializeTptCalculatorPage() {
    console.log('Initializing TPT Calculator Page...');
    const tptFileInput = document.getElementById('tptFileInput');
    const calculateTptButton = document.getElementById('calculateTptButton');
    const tptResultsDiv = document.getElementById('tptResults');
    const tptOutputParagraph = document.getElementById('tptOutput');
    const tptLowestInput = document.getElementById('tptLowest');
    const tptHighestInput = document.getElementById('tptHighest');
    const tptTargetInput = document.getElementById('tptTarget');
    const saveTptSettingsButton = document.getElementById('saveTptSettingsBtn');
    const includeBirthdayBlasterCheckbox = document.getElementById('includeBirthdayBlaster');
    const individualGameTableSection = document.getElementById('individualGameTableSection');
    const individualGameTableBody = document.getElementById('individualGameTableBody');
    const exportIndividualGamesCsvBtn = document.getElementById('exportIndividualGamesCsvBtn');
    const tptSettingsContainer = document.getElementById('tptSettingsContainer');
    const toggleTptSettingsBtn = document.getElementById('toggleTptSettingsBtn');
    const tptSettingsToggleIcon = toggleTptSettingsBtn ? toggleTptSettingsBtn.querySelector('.fas') : null;
    console.log('TPT Settings Toggle Elements:', { container: tptSettingsContainer, button: toggleTptSettingsBtn, icon: tptSettingsToggleIcon });
    if (toggleTptSettingsBtn && tptSettingsContainer && tptSettingsToggleIcon) { /* ... */ }
    async function loadTptSettings() { /* ... */ }
    if (saveTptSettingsButton) { /* ... */ }
    loadTptSettings();
    let lastCalculationResult = null;
    if (calculateTptButton) { /* ... */ }
    if (exportIndividualGamesCsvBtn) { /* ... */ }
}


// --- Main Application Initialization (This is the block you need to REPLACE) ---
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentDate(); // Update date on any page

    // --- Weather display elements (Moved to the top of DOMContentLoaded) ---
    const weatherIconElement = document.getElementById('weatherIconHeader');
    const weatherTempElement = document.getElementById('weatherTempHeader');
    const weatherDescElement = document.getElementById('weatherDescHeader');

    // TPT Display Element Reference
    const sidebarBottomTptTargetValue = document.getElementById('sidebarBottomTptTargetValue');

     // Urgent Issues Badge Element Reference (Added)
    const urgentIssueBadge = document.getElementById('urgentIssue'); // Your <span> with id="urgentIssue"
    const urgentIssueBadgeContainer = urgentIssueBadge ? urgentIssueBadge.closest('.urgent-issue') : null; // Get the parent div


    // --- Weather Logic (DEFINED AND CALLED HERE) ---
    async function fetchWeather() {
        console.log("DEBUG: fetchWeather() function entered.");
        if (!weatherIconElement || !weatherTempElement || !weatherDescElement) {
            console.warn("DEBUG: Weather display elements not found on this page. Cannot fetch weather.");
            return;
        }

        try {
            console.log("DEBUG: Attempting to fetch weather from /weather endpoint.");
            const response = await fetch('/weather');

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();

            // Current time check to decide if it's day or night for icon coloring
            const now = new Date();
            const currentHour = now.getHours();
            const isDay = currentHour >= 6 && currentHour < 18; // Roughly 6 AM to 6 PM

            weatherTempElement.textContent = `${Math.round(data.temperature)}°F`;
            weatherDescElement.textContent = data.description;

            let iconClass = 'pe-7s-cloud'; // Default to cloudy
            if (data.icon === '01d') iconClass = 'pe-7s-sun'; // clear sky (day)
            else if (data.icon === '01n') iconClass = 'pe-7s-moon'; // clear sky (night)
            else if (data.icon === '02d') iconClass = 'pe-7s-cloud-sun'; // few clouds (day)
            else if (data.icon === '02n') iconClass = 'pe-7s-cloud-moon'; // few clouds (night)
            else if (data.icon.startsWith('03') || data.icon.startsWith('04')) iconClass = 'pe-7s-cloud'; // scattered/broken clouds
            else if (data.icon.startsWith('09') || data.icon.startsWith('10')) iconClass = 'pe-7s-rain'; // rain
            else if (data.icon.startsWith('11')) iconClass = 'pe-7s-thunder'; // thunderstorm
            else if (data.icon.startsWith('13')) iconClass = 'pe-7s-snow'; // snow
            else if (data.icon.startsWith('50')) iconClass = 'pe-7s-fog'; // mist/haze

            weatherIconElement.className = `weather-icon ${iconClass}`; // Update icon class

            // Dynamic color for icon based on day/night or temperature (refinement)
            if (data.temperature > 85) {
                weatherIconElement.style.color = '#FF5722'; // Orange/Red for hot
            } else if (data.temperature < 40) {
                weatherIconElement.style.color = '#2196F3'; // Blue for cold
            } else if (isDay) {
                weatherIconElement.style.color = '#FFC107'; // Yellow for day icon
            } else {
                weatherIconElement.style.color = '#B0B0B0'; // Grayish for night icon
            }

            // Dynamic color for temperature text
            if (data.temperature > 80) {
                weatherTempElement.style.color = '#F44336'; // Hot
            } else if (data.temperature < 40) {
                weatherTempElement.style.color = '#2196F3'; // Cold
            } else {
                weatherTempElement.style.color = 'var(--text-color)'; // Default text color
            }


        } catch (error) {
            console.error("DEBUG: Error in fetchWeather() catch block:", error);
            weatherTempElement.textContent = '--°F';
            weatherDescElement.textContent = 'Failed';
            weatherIconElement.className = 'weather-icon pe-7s-close';
            weatherIconElement.style.color = '#F44336'; // Red for error
        }
    }

    fetchWeather(); // Initial fetch when the page loads
    setInterval(fetchWeather, 600000); // Update every 10 minutes (600000 ms)


    // --- NEW: Urgent Issues Count Fetching and Display Logic ---
    async function fetchUrgentIssuesCount() {
        if (!urgentIssueBadge || !urgentIssueBadgeContainer) {
            console.warn("DEBUG: Urgent issues badge elements not found. Cannot fetch count.");
            return;
        }
        try {
            const response = await fetch('/api/urgent_issues_count');
            if (!response.ok) {
                throw new Error(`Failed to fetch urgent issues count: ${response.statusText}`);
            }
            const data = await response.json();
            const count = data.count;

            if (count > 0) {
                urgentIssueBadge.textContent = `${count} Urgent Issue${count > 1 ? 's' : ''}`; // e.g., "1 Urgent Issue" or "2 Urgent Issues"
                urgentIssueBadgeContainer.style.display = 'flex'; // Show the badge
                urgentIssueBadgeContainer.style.animation = 'pulseRed 1.5s infinite alternate'; // Re-apply animation (or ensure it's not removed)
            } else {
                urgentIssueBadge.textContent = DEFAULT_URGENT_ISSUE_TEXT; // "No Urgent Issues"
                urgentIssueBadgeContainer.style.display = 'none'; // Hide the badge
                urgentIssueBadgeContainer.style.animation = 'none'; // Stop animation when hidden
            }
            console.log(`DEBUG: Urgent issues count fetched: ${count}`);

        } catch (error) {
            console.error("DEBUG: Error fetching urgent issues count:", error);
            urgentIssueBadge.textContent = "Error"; // Display error text
            urgentIssueBadgeContainer.style.display = 'flex'; // Still show it to alert error
            urgentIssueBadgeContainer.style.animation = 'none'; // Stop animation on error
        }
    }

    // Call the new function when the Dashboard page initializes
    // This is located within the initializeDashboardPage function's call
    // We will add the call later in initializeDashboardPage itself.


    // --- TPT and other Dashboard Metrics Logic ---
    async function fetchInitialDataAndDashboardMetrics() {
        console.log("Fetching initial dashboard metrics and TPT.");

        try {
            const response = await fetch('/api/tpt_settings');
            if (!response.ok) {
                throw new Error(`Failed to load TPT settings for dashboard: ${response.statusText}`);
            }
            const settings = await response.json();

            if (sidebarBottomTptTargetValue) {
                if (settings.targetTpt) {
                    sidebarBottomTptTargetValue.textContent = `Target: ${parseFloat(settings.targetTpt).toFixed(2)}`;
                } else {
                    sidebarBottomTptTargetValue.textContent = `Target: N/A`;
                }
            }
            console.log("Dashboard TPT Target loaded from database:", settings.targetTpt);
        } catch (error) {
            console.error("Error loading TPT target for dashboard:", error);
            if (sidebarBottomTptTargetValue) {
                sidebarBottomTptTargetValue.textContent = `Target: N/A`;
            }
        }
    }


    // --- Header Bar Functionality (Event Listeners) ---
    const searchBar = document.getElementById('searchBar');
    const notificationBell = document.getElementById('notificationBell');
    const profileIcon = document.getElementById('profileIcon');

    if (searchBar) {
        searchBar.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                showCustomPopup('Search', `You searched for: "${this.value}"`);
            }
        });
    }

    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            showCustomPopup('Notifications', 'No new notifications.');
        });
    }

    if (profileIcon) {
        profileIcon.addEventListener('click', function() {
            showCustomPopup('Profile', 'User profile and settings will be here.');
        });
    }


    // --- Page Initialization Logic ---
    const currentPath = window.location.pathname;
    const cleanPath = currentPath.endsWith('/') && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;

    if (cleanPath === '/' || cleanPath === '/index.html') {
        initializeDashboardPage();
        fetchInitialDataAndDashboardMetrics();
    } else if (cleanPath === '/inventory' || cleanPath === '/game_inventory.html') {
        initializeGameInventoryPage();
    } else if (cleanPath === '/tpt_calculator' || cleanPath === '/tpt_calculator.html') {
        initializeTptCalculatorPage();
    } else {
        console.log(`Unknown page path: ${cleanPath}. No specific JS initialized.`);
    }

    window.showDashboard = function() {
        console.log('Dashboard link clicked (via global function).');
    };
}); // Closes document.addEventListener('DOMContentLoaded', function() { ... });

// IMPORTANT: Make sure these page-specific initialization functions are DEFINED OUTSIDE this DOMContentLoaded block
// if they are called inside it. If they are defined inside, they won't be accessible from other parts of the code.
// Example:
// function initializeDashboardPage() { ... }
// function initializeGameInventoryPage() { ... }
// function initializeTptCalculatorPage() { ... }