// =========================================================================
// ARCADE MANAGER - DASHBOARD ISSUES CARD & MODAL
// =========================================================================

const $ = (q, root = document) => root.querySelector(q);

// Helper function to show toasts (ensures it works even if toast.js isn't loaded yet)
function toast(msg, type = 'success') {
    if (window.showToast) window.showToast(msg, type);
    else console.log(`${type}: ${msg}`);
}

// Function to fetch games from the API and populate the datalist
async function fetchAndPopulateGames() {
    const datalist = document.getElementById('games-list');
    if (!datalist) return;
    
    // Clear any existing options to prevent duplicates
    datalist.innerHTML = '';

    try {
        const response = await fetch('/api/games');
        if (!response.ok) {
            throw new Error('Failed to fetch game list from API.');
        }
        const games = await response.json();

        if (games && games.length > 0) {
            games.forEach(game => {
                const option = document.createElement('option');
                option.value = game.name;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching games:", error);
    }
}

// NEW FUNCTION: Calculate target date one week ahead, skipping weekends
function calculateTargetDate() {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 7); // Add 7 days to get one week ahead

    let dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // If it's Saturday (6), add 2 days to get to Monday
    if (dayOfWeek === 6) {
        targetDate.setDate(targetDate.getDate() + 2);
    }
    // If it's Sunday (0), add 1 day to get to Monday
    else if (dayOfWeek === 0) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    // Format date to YYYY-MM-DD for input type="date"
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(targetDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// Function to handle form submission
async function submitNewIssueForm(e) {
    e.preventDefault();

    // NEW LOGIC: Check if the notes field is empty and set to "N/A"
    const notesInput = document.getElementById('notesInput');
    if (notesInput && notesInput.value.trim() === '') {
        notesInput.value = 'N/A';
    }

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Log the data to the browser console for debugging
    console.log("Form Data Submitted:", data);

    // Basic validation, now including equipmentName
    if (!data.problemDescription || !data.equipmentName || !data.targetDate) {
        toast('Problem description, equipment name, and target date are required.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/issues', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await res.json();

        if (res.ok) {
            toast('Issue added successfully!', 'success');
            // Close the modal
            form.closest('.simple-modal').hidden = true;
            // Reset the form for the next use
            form.reset();

            // Crucial step: Call the refresh function on the Issue Hub page
            if (window.refreshIssuesTableData && typeof window.refreshIssuesTableData === 'function') {
                window.refreshIssuesTableData();
            }

            // Update the dashboard counts
            if (window.initIssuesCard && typeof window.initIssuesCard === 'function') {
                window.initIssuesCard();
            }
        } else {
            // Log the full error response to the console
            console.error("Backend Error Response:", result);

            // Display the specific error message from the backend
            toast(`Error: ${result.error}`, 'error');
        }
    } catch (err) {
        console.error("Network Error:", err);
        toast('Failed to connect to server.', 'error');
    }
}

// Function to open the modal
function openAddIssueModal() {
    const modal = $('#addIssueModal');
    if (modal) {
        modal.hidden = false;
        // Pre-fill employee names from the shared function
        if (window.populateEmployees && typeof window.populateEmployees === 'function') {
            window.populateEmployees();
        }
        // Call the new function to populate the games list
        fetchAndPopulateGames();

        // NEW: Set the target date input value
        const targetDateInput = $('#targetDateInput');
        if (targetDateInput) {
            targetDateInput.value = calculateTargetDate();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const card = $('#addNewIssueCard');
    const form = $('#addIssueModal form');
    const closeBtn = $('#addIssueModal .simple-modal__close');
    const issueTypeChips = $('#issueTypeChips');
    const equipmentNameInput = $('#equipmentNameInput');
    // NEW: Get a reference to the hidden category input
    const categoryInput = $('#categoryInput');

    if (card) {
        card.addEventListener('click', openAddIssueModal);
    }
    if (form) {
        form.addEventListener('submit', submitNewIssueForm);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.simple-modal').hidden = true;
        });
    }

    // Since the Issue Hub's JavaScript might load after this one,
    // we'll listen for the refresh event.
    window.addEventListener('issuesRefreshed', () => {
        // You can add logic here if you need to know when the table has refreshed
    });

    // NEW LOGIC: Handle the Game/Facility/Attraction toggle
    if (issueTypeChips) {
        issueTypeChips.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON' && event.target.dataset.type) {
                // Remove the 'active' class from all chips
                document.querySelectorAll('#issueTypeChips .chip').forEach(chip => {
                    chip.classList.remove('active');
                });
                // Add the 'active' class to the clicked chip
                event.target.classList.add('active');

                // Update the placeholder of the equipment input and category based on the selected type
                const selectedType = event.target.dataset.type;
                if (selectedType === 'game') {
                    equipmentNameInput.placeholder = 'Select or type a game name';
                    equipmentNameInput.removeAttribute('list'); // Remove datalist for facility
                    equipmentNameInput.setAttribute('list', 'games-list'); // Add datalist for game
                    fetchAndPopulateGames(); // Fetch and populate games when 'Game' is selected
                    categoryInput.value = 'gameroom';
                } else if (selectedType === 'facility') {
                    equipmentNameInput.placeholder = 'e.g., Bathroom sink, Lobby ceiling, Prize counter';
                    equipmentNameInput.removeAttribute('list');
                    categoryInput.value = 'facility';
                } else if (selectedType === 'attraction') {
                    equipmentNameInput.placeholder = 'e.g., Adventure Zone & Dancefloor';
                    equipmentNameInput.removeAttribute('list');
                    categoryInput.value = 'attraction';
                }
            }
        });
    }
});