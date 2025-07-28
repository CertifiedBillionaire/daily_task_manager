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
    {
        id: 'check_tpt_reports',
        text: 'Review TPT Reports: Weekly (Mondays) / Daily (Tue-Fri) to identify runoff or payout anomalies.',
        type: 'action',
        actionText: 'View TPT Reports',
        actionLink: '#'
    },
    {
        id: 'form_issue_plan',
        text: 'Based on TPT and game issues, form today\'s priority workload and plan of action.',
        type: 'action',
        actionText: 'Generate Today\'s Plan',
        actionLink: '#'
    },
    { id: 'facilities_walkaround', text: 'Perform facilities walk-around for safety/security (doors, alarms, emergency lighting, etc.).', type: 'boolean' },
    { id: 'adventure_zone_walkthrough', text: 'Conduct Adventure Zone walkthrough for safety/security/cleanliness.', type: 'boolean' },
    { id: 'daily_game_tap', text: 'Perform daily game tap checks.', type: 'boolean' },
    { id: 'verify_thank_you_boxes', text: 'Verify "Thank You" boxes are properly stocked and ready for the day.', type: 'boolean' },
    {
        id: 'set_pms_plan',
        text: 'Set plan for daily PMs (preventative maintenance for restaurant equipment/show/games).',
        type: 'action',
        actionText: 'View PM Schedule',
        actionLink: '#'
    },
    {
        id: 'address_priority_issues',
        text: 'Get started by addressing priority issues (e.g., down games over PMs).',
        type: 'action',
        actionText: 'View Urgent Issues',
        actionLink: '#'
    },
    {
        id: 'district_management_issues',
        text: 'Address facilities issues needing district management attention (e.g., wall near beverage bar replace and seal).',
        type: 'action',
        actionText: 'Log District Issue',
        actionText: 'Log District Issue',
        actionLink: '#'
    }
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
    // Handle custom content for popup body
    if (customContent && popupMessage) {
        popupMessage.innerHTML = message + customContent;
    } else {
        popupMessage.textContent = message;
    }

    popupActions.innerHTML = ''; // Clear previous buttons

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

// --- Page-Specific Initialization Functions ---
// Consolidating all dashboard page initialization logic into a single, correctly defined function
function initializeDashboardPage() {
    console.log('Initializing Dashboard Page...');

    const taskListUl = document.querySelector('#daily-tasks-section .task-list');
    const addTaskButton = document.querySelector('#daily-tasks-section .add-task-button');

    // --- Daily Task Management Functions (Specific to Dashboard Page) ---
    // Removed all localStorage related task functions and references
    // let dailyTasks = []; (moved to global, but commented out)
    // function loadTasks() { ... }
    // function saveTasks() { ... }

    // Placeholder `dailyTasks` array for temporary functionality until database is set up
    // In a real app, this would be loaded from the server
    let dailyTasks = []; // Re-introduce as an empty array, will be populated via API later

    function renderTasks() {
        if (!taskListUl) return;

        taskListUl.innerHTML = '';

        if (dailyTasks.length === 0) {
            taskListUl.innerHTML = `<li><span style="color: #888;">No tasks for today! Add one below.</span></li>`;
            return;
        }

        dailyTasks.forEach((task, index) => {
            const li = document.createElement('li');
            li.dataset.index = index;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `task-${index}`;
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', (event) => {
                dailyTasks[index].completed = event.target.checked;
                // No saveTasks() call here, as localStorage is removed
                renderTasks(); // Re-render to update appearance
            });
            li.appendChild(checkbox);

            const label = document.createElement('label');
            label.htmlFor = `task-${index}`;
            label.textContent = task.text;
            li.appendChild(label);

            if (task.priority) {
                const prioritySpan = document.createElement('span');
                prioritySpan.classList.add('task-priority', task.priority.toLowerCase().replace(/\s/g, ''));
                prioritySpan.textContent = task.priority;
                li.appendChild(prioritySpan);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.classList.add('task-delete-btn');
            deleteBtn.title = 'Delete Task';
            deleteBtn.addEventListener('click', () => {
                showCustomPopup('Delete Task', 'Are you sure you want to delete this task?', [
                    { text: 'Cancel', class: 'cancel-button', action: () => hideCustomPopup() },
                    { text: 'Delete', class: 'delete-button', action: () => {
                        dailyTasks.splice(index, 1);
                        // No saveTasks() call here, as localStorage is removed
                        renderTasks();
                        hideCustomPopup();
                    }}
                ]);
            });
            li.appendChild(deleteBtn);

            taskListUl.appendChild(li);
        });
    }

    if (addTaskButton) {
        addTaskButton.addEventListener('click', function() {
            showCustomPopup(
                'Add New Daily Task',
                'Enter task description and priority:',
                [
                    { text: 'Add Task', class: 'popup-button', action: () => {
                        const description = document.getElementById('newTaskDescription').value.trim();
                        const priority = document.getElementById('newTaskPriority').value;
                        if (description) {
                            dailyTasks.push({ text: description, completed: false, priority: priority });
                            // No saveTasks() call here, as localStorage is removed
                            renderTasks();
                            hideCustomPopup();
                        } else {
                            showCustomPopup('Input Required', 'Task description cannot be empty.');
                        }
                    }},
                    { text: 'Cancel', class: 'cancel-button', action: () => hideCustomPopup() }
                ],
                `<textarea id="newTaskDescription" rows="3" placeholder="e.g., Check ticket machine levels"></textarea>
                <select id="newTaskPriority" style="width: calc(100% - 20px); padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px;">
                    <option value="">No Priority</option>
                    <option value="High Priority">High Priority</option>
                    <option value="Cleanliness">Cleanliness</option>
                    <option value="Parts Needed">Parts Needed</option>
                    <option value="Facility Issue">Facility Issue</option>
                </select>`
            );
        });
    }

    // Removed: loadTasks(); // Initial load of tasks when dashboard page is initialized
    // This call is removed because localStorage is no longer used for tasks.
    // Tasks will now be in-memory for the session until database integration.


    // --- Other Dashboard Specific Initializations (Keep these!) ---
    const startOpeningChecklistButton = document.querySelector('#startOpeningChecklist .card-action-button');
    if (startOpeningChecklistButton) {
        startOpeningChecklistButton.addEventListener('click', openOpeningChecklistModal);
    }

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

    // Removed: let games = JSON.parse(localStorage.getItem('gameList')) || [];
    // New: Initialize as an empty array. Data will come from backend later.
    let games = [];

    function renderGameList() {
        gameListBody.innerHTML = '';
        if (games.length === 0) {
            gameListBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #888; padding: 20px;">No games in inventory. Add some!</td></tr>';
            return;
        }

        games.forEach((game) => {
            const row = gameListBody.insertRow();
            row.dataset.id = game.id;

            const nameCell = row.insertCell();
            nameCell.textContent = game.name;
            nameCell.setAttribute('data-label', 'Game Name');

            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.textContent = game.status.charAt(0).toUpperCase() + game.status.slice(1);
            statusSpan.classList.add(`status-${game.status}`);
            statusCell.appendChild(statusSpan);
            statusCell.setAttribute('data-label', 'Status');

            const actionsCell = row.insertCell();
            actionsCell.setAttribute('data-label', 'Actions');
            const actionButtonsDiv = document.createElement('div');
            actionButtonsDiv.classList.add('action-buttons');

            const editButton = document.createElement('button');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Edit Game';
            editButton.addEventListener('click', (event) => {
                event.stopPropagation();
                editGame(game.id);
            });
            actionButtonsDiv.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteButton.title = 'Delete Game';
            deleteButton.classList.add('delete-button');
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                deleteGame(game.id);
            });
            actionButtonsDiv.appendChild(deleteButton);

            actionsCell.appendChild(actionButtonsDiv);
        });
    }

    if (addGameButton) {
        addGameButton.addEventListener('click', function() {
            const name = gameNameInput.value.trim();
            const status = gameStatusSelect.value;

            if (name) {
                const newGame = {
                    id: Date.now(),
                    name: name,
                    status: status,
                    addedDate: new Date().toISOString().split('T')[0]
                };
                games.push(newGame);
                // Removed: localStorage.setItem('gameList', JSON.stringify(games));
                renderGameList();
                gameNameInput.value = '';
                gameStatusSelect.value = 'active';
            } else {
                showCustomPopup('Input Required', 'Please enter a game name.');
            }
        });
    }

    function deleteGame(id) {
        showCustomPopup(
            'Confirm Delete',
            'Are you sure you want to delete this game?',
            [
                { text: 'Cancel', class: 'cancel-button', action: () => hideCustomPopup() },
                { text: 'Delete', class: 'delete-button', action: () => {
                    games = games.filter(game => game.id !== id);
                    // Removed: localStorage.setItem('gameList', JSON.stringify(games));
                    renderGameList();
                    hideCustomPopup();
                }}
            ]
        );
    }

    function editGame(id) {
        showCustomPopup('Feature Coming Soon', 'Edit functionality for game ID: ' + id + ' is coming soon!');
    }

    if (exportGameListButton) {
        exportGameListButton.addEventListener('click', function() {
            if (games.length === 0) {
                showCustomPopup('No Data', 'No games to export!');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Game Name,Status,Added Date\n";

            games.forEach(game => {
                const escapedName = `"${game.name.replace(/"/g, '""')}"`;
                csvContent += `${escapedName},${game.status},${game.addedDate}\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "game_inventory.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // Removed: renderGameList();
    // Re-introduce as a simple call, for now just to show "No games" message.
    renderGameList(); // Initial render to show empty table state.
}

// static/js/app.js

// ... (Your Global Configuration, Task Management Variables, Opening Checklist Steps, and Utility Functions remain unchanged above this) ...


// Function to initialize the TPT Calculator page specific logic
function initializeTptCalculatorPage() {
    console.log('Initializing TPT Calculator Page...');

    const tptFileInput = document.getElementById('tptFileInput');
    const calculateTptButton = document.getElementById('calculateTptButton');
    const tptResultsDiv = document.getElementById('tptResults');
    const tptOutputParagraph = document.getElementById('tptOutput');

    // --- TPT Setting Input Elements ---
    const tptLowestInput = document.getElementById('tptLowest');
    const tptHighestInput = document.getElementById('tptHighest');
    const tptTargetInput = document.getElementById('tptTarget');
    const saveTptSettingsButton = document.getElementById('saveTptSettingsBtn');
    const includeBirthdayBlasterCheckbox = document.getElementById('includeBirthdayBlaster');

    // --- Individual Game Table Elements ---
    const individualGameTableSection = document.getElementById('individualGameTableSection');
    const individualGameTableBody = document.getElementById('individualGameTableBody');
    const exportIndividualGamesCsvBtn = document.getElementById('exportIndividualGamesCsvBtn');




    // --- Logic for the TPT Settings Toggle Button ---
    const tptSettingsContainer = document.getElementById('tptSettingsContainer');
    const toggleTptSettingsBtn = document.getElementById('toggleTptSettingsBtn');
    const tptSettingsToggleIcon = toggleTptSettingsBtn ? toggleTptSettingsBtn.querySelector('.fas') : null;

    console.log('TPT Settings Toggle Elements:', { // ADD THIS LINE FOR DEBUGGING
        container: tptSettingsContainer,
        button: toggleTptSettingsBtn,
        icon: tptSettingsToggleIcon
    });

    if (toggleTptSettingsBtn && tptSettingsContainer && tptSettingsToggleIcon) {
        function updateTptSettingsIcon() {
            if (tptSettingsContainer.classList.contains('collapsed')) {
                tptSettingsToggleIcon.classList.remove('fa-times');
                tptSettingsToggleIcon.classList.add('fa-bars');
            } else {
                tptSettingsToggleIcon.classList.remove('fa-bars');
                tptSettingsToggleIcon.classList.add('fa-times');
            }
        }
        updateTptSettingsIcon(); // Set initial icon state based on current class
        toggleTptSettingsBtn.addEventListener('click', () => {
            tptSettingsContainer.classList.toggle('collapsed');
            updateTptSettingsIcon(); // Update icon after toggling class
        });
    }

// ... (rest of initializeTptCalculatorPage function) ...
    // --- Load TPT Settings from Database on page load (MODIFIED THIS FUNCTION) ---
    async function loadTptSettings() {
        try {
            const response = await fetch('/api/tpt_settings'); // Call the new backend API
            if (!response.ok) {
                throw new Error(`Failed to load TPT settings: ${response.statusText}`);
            }
            const settings = await response.json();
            
            // Populate the input fields with fetched settings
            if (tptLowestInput) tptLowestInput.value = settings.lowestDesiredTpt;
            if (tptHighestInput) tptHighestInput.value = settings.highestDesiredTpt;
            if (tptTargetInput) tptTargetInput.value = settings.targetTpt;
            if (includeBirthdayBlasterCheckbox) {
                includeBirthdayBlasterCheckbox.checked = settings.includeBirthdayBlaster; // This is already a boolean from Flask
            }
            console.log("TPT Settings loaded from database:", settings);
        } catch (error) {
            console.error("Error loading TPT settings:", error);
            showCustomPopup('Load Error', 'Failed to load TPT settings. Defaults will be used.');
            // Fallback to hardcoded defaults if API call fails
            if (tptLowestInput) tptLowestInput.value = '2.00';
            if (tptHighestInput) tptHighestInput.value = '4.00';
            if (tptTargetInput) tptTargetInput.value = '3.00';
            if (includeBirthdayBlasterCheckbox) includeBirthdayBlasterCheckbox.checked = true;
        }
    }

    // --- Save TPT Settings to Database on Save button click (MODIFIED THIS EVENT LISTENER) ---
    if (saveTptSettingsButton) {
        saveTptSettingsButton.addEventListener('click', async () => {
            const settingsToSave = {
                lowestDesiredTpt: tptLowestInput ? tptLowestInput.value : '2.00',
                highestDesiredTpt: tptHighestInput ? tptHighestInput.value : '4.00',
                targetTpt: tptTargetInput ? tptTargetInput.value : '3.00',
                includeBirthdayBlaster: includeBirthdayBlasterCheckbox ? includeBirthdayBlasterCheckbox.checked : true
            };

            try {
                const response = await fetch('/api/tpt_settings', { // Call the new backend API
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', // Tell Flask we're sending JSON
                    },
                    body: JSON.stringify(settingsToSave), // Convert JavaScript object to JSON string
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Failed to save TPT settings: ${response.statusText}`);
                }
                const result = await response.json(); // Get the JSON response from Flask
                showCustomPopup('Settings Saved', result.message); // Display Flask's success message
                console.log('TPT Settings saved to database:', settingsToSave);

                // Immediately update the TPT target in the sidebar after saving (MODIFIED)
                const sidebarBottomTptTargetValue = document.getElementById('sidebarBottomTptTargetValue');
                if (sidebarBottomTptTargetValue) {
                    sidebarBottomTptTargetValue.textContent = `Target: ${parseFloat(settingsToSave.targetTpt).toFixed(2)}`;
                }

            } catch (error) {
                console.error("Error saving TPT settings:", error);
                showCustomPopup('Save Error', `Failed to save TPT settings: ${error.message}`);
            }
        });
    }

    // Call load settings when the TPT Calculator page initializes
    loadTptSettings();

    // --- Variable to store the last calculation result for CSV export scope ---
    let lastCalculationResult = null;    

    // --- Logic for the Calculate TPT Button (UNCHANGED from previous step) ---
    if (calculateTptButton) {
        calculateTptButton.addEventListener('click', async () => {
            if (tptFileInput.files.length === 0) {
                showCustomPopup('No File Selected', 'Please select a TPT data file to upload.');
                return;
            }

            const file = tptFileInput.files[0];
            const formData = new FormData();
            formData.append('tpt_file', file);

            // Pass current (even if not saved) settings to the backend for this calculation
            if (tptLowestInput) formData.append('lowest_tpt', tptLowestInput.value);
            if (tptHighestInput) formData.append('highest_tpt', tptHighestInput.value);
            if (tptTargetInput) formData.append('target_tpt', tptTargetInput.value);
            if (includeBirthdayBlasterCheckbox) {
                formData.append('include_birthday_blaster', includeBirthdayBlasterCheckbox.checked);
            }

            tptResultsDiv.style.display = 'block';
            tptOutputParagraph.innerHTML = `<em>Processing file: ${file.name}...</em>`;

            try {
                const response = await fetch('/api/calculate_tpt', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                lastCalculationResult = result; // Store the result for the export button

                // Display summary results
                tptOutputParagraph.innerHTML = `
                    <strong>Results for ${result.file_name || 'file'}:</strong><br>
                    Games Out of Range: ${result.games_out_of_range}<br>
                    Total TPT Average: ${result.total_tpt_average}<br>
                    TPT (with Birthday Blaster): ${result.tpt_with_blaster}<br>
                    TPT (without Birthday Blaster): ${result.tpt_without_blaster}<br>
                    <small>${result.message || ''}</small>
                `;
                console.log("TPT Calculation Results:", result);

                // --- Render Individual Game Data Table ---
                if (individualGameTableSection && individualGameTableBody && result.individual_games && result.individual_games.length > 0) {
                    individualGameTableBody.innerHTML = ''; // Clear previous table data
                    result.individual_games.forEach(game => {
                        const row = individualGameTableBody.insertRow();
                        row.insertCell().textContent = game.Profile;
                        row.insertCell().textContent = game.GameName;
                        row.insertCell().textContent = game.TPTIndividual;
                        row.insertCell().textContent = game.TotalTickets;
                        row.insertCell().textContent = game.TotalPlays;
                    });
                    individualGameTableSection.style.display = 'block'; // Show the table section
                } else if (individualGameTableSection) {
                    individualGameTableSection.style.display = 'none'; // Hide if no data
                    console.warn("No individual game data to display or elements not found.");
                }

            } catch (error) {
                console.error("Error calculating TPT:", error);
                tptOutputParagraph.textContent = `Error processing file: ${error.message}. Please check console for details.`;
                if (individualGameTableSection) individualGameTableSection.style.display = 'none'; // Hide table on error
            }
        });
    }

    // --- Export Individual Games CSV Button Logic (UNCHANGED) ---
    if (exportIndividualGamesCsvBtn) {
        exportIndividualGamesCsvBtn.addEventListener('click', () => {
            // Use lastCalculationResult to access the data
            if (lastCalculationResult && lastCalculationResult.individual_games && lastCalculationResult.individual_games.length > 0) {
                let csvContent = "data:text/csv;charset=utf-8,";
                
                // Add headers
                const headers = ["Profile", "Game Name", "TPT (Individual)", "Total Tickets", "Total Plays"];
                csvContent += headers.join(",") + "\n";

                // Add rows
                for (const game of lastCalculationResult.individual_games) {
                    const rowData = [
                        `"${(game.Profile || '').toString().replace(/"/g, '""')}"`,
                        `"${(game.GameName || '').toString().replace(/"/g, '""')}"`,
                        game.TPTIndividual,
                        game.TotalTickets,
                        game.TotalPlays
                    ];
                    csvContent += rowData.join(",") + "\n";
                }

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `individual_game_data_${new Date().toISOString().slice(0,10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showCustomPopup('Export Complete', 'Individual game data exported successfully as CSV!');
            } else {
                showCustomPopup('No Data', 'No individual game data to export. Please calculate TPT first.');
            }
        });
    }
}
// ... (rest of initializeGameInventoryPage and initializeDashboardPage, unchanged from previous step) ...


// --- Main Application Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentDate(); // Update date on any page
    // --- Weather display elements (Moved to the top of DOMContentLoaded) ---
    const weatherIconElement = document.getElementById('weatherIconHeader');
    const weatherTempElement = document.getElementById('weatherTempHeader');
    const weatherDescElement = document.getElementById('weatherDescHeader');


    // ... (rest of header element references, unchanged) ...

    // TPT Display Element Reference
    const sidebarBottomTptTargetValue = document.getElementById('sidebarBottomTptTargetValue'); // Reference to TPT Target in sidebar bottom

    // ... (rest of weather logic, unchanged) ...

    // --- TPT and other Dashboard Metrics Logic (MODIFIED THIS FUNCTION) ---
    async function fetchInitialDataAndDashboardMetrics() {
        console.log("Fetching initial dashboard metrics and TPT.");

        try {
            const response = await fetch('/api/tpt_settings'); // Call the backend API
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
                sidebarBottomTptTargetValue.textContent = `Target: N/A`; // Fallback to N/A on error
            }
            showCustomPopup('Data Load Error', 'Could not load TPT target for dashboard. It might not be set yet.');
        }
    }


    // --- Header Bar Functionality (Event Listeners) ---
    // ... (rest of header bar functionality, unchanged) ...

    // --- Page Initialization Logic ---
    const currentPath = window.location.pathname;

    if (currentPath === '/' || currentPath === '/index.html') { // Dashboard page
        initializeDashboardPage();
        fetchInitialDataAndDashboardMetrics(); // Call this on dashboard page load
    } else if (currentPath === '/inventory' || currentPath === '/game_inventory.html') { // Game Inventory page
        initializeGameInventoryPage();
    } else if (currentPath === '/tpt_calculator' || currentPath === '/tpt_calculator.html') { // TPT Calculator page
        initializeTptCalculatorPage();
    } else {
        console.log(`Unknown page path: ${currentPath}. No specific JS initialized.`);
    }

    // Making showDashboard globally accessible (if needed by inline onclick attributes)
    window.showDashboard = function() {
        console.log('Dashboard link clicked (via global function).');
    };
}); // Closes document.addEventListener('DOMContentLoaded', function() { ... });

