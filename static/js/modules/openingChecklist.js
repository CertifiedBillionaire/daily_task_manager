// =========================================================================
// ARCADE MANAGER - OPENING CHECKLIST MODULE
// =========================================================================

// This is an array that holds all the steps for our checklist.
// Each step is an "object" with a title and the question text.
export const checklistSteps = [
    {
        title: "Initial Walk-Through",
        text: "Have you completed the initial walk-through of the showroom floor?"
    },
    {
        title: "Game Status",
        text: "Are all games powered on and in attract mode?"
    },
    {
        title: "Safety & Cleanliness",
        text: "Is the showroom floor clean and free of any safety hazards?"
    },
    {
        title: "Final Check",
        text: "Checklist complete. Are you ready to open?"
    }
];

// This function reads saved data and updates the card's progress text
export function updateChecklistProgress() {
    // Find the progress text element on the card
    const checklistCardProgress = document.querySelector('#startOpeningChecklist .card-progress');
    
    // If the element doesn't exist, stop.
    if (!checklistCardProgress) return;

    // Get the list of completed steps from the browser's storage, 
    // or create an empty array if nothing is saved yet.
    const completedSteps = JSON.parse(localStorage.getItem('completedChecklistSteps')) || [];
    
    // Get the total number of steps from our checklist array
    const totalSteps = checklistSteps.length;

    // Update the text on the card (e.g., "1/4 Done")
    checklistCardProgress.textContent = `${completedSteps.length}/${totalSteps} Done`;
}

/**
 * This is the main function that initializes all the logic for the checklist.
 * It finds the HTML elements and adds the click behaviors.
 */
function initOpeningChecklist() {
    
    // --- 1. FIND ALL HTML ELEMENTS ---
    // We get all the elements we need from the HTML and store them in constants.
    const checklistCard = document.getElementById('startOpeningChecklist');      // The card on the dashboard
    const checklistModal = document.getElementById('openingChecklistModal');    // The main pop-up modal container
    const closeButton = document.getElementById('closeChecklistModalButton'); // The 'X' button in the modal
    const nextButton = document.getElementById('checklistNextButton');        // The 'Next' button
    const backButton = document.getElementById('checklistBackButton');        // The 'Back' button
    const stepTextElement = document.getElementById('checklistStepText');     // The text area for the question
    const stepCounterElement = document.getElementById('checklistStepCounter'); // The "Step X of Y" text

    // --- 2. SAFETY CHECK (GUARD CLAUSE) ---
    // This is a crucial check. If any of the elements above were not found in the
    // HTML, the script will stop running this function to prevent errors.
    // The syntax here is now corrected.
    if (!checklistCard || !checklistModal || !nextButton || !backButton || !stepCounterElement) {
        console.error("Checklist Error: One or more required HTML elements were not found.");
        return; 
    }

    // --- 3. STATE MANAGEMENT ---
    // This variable will remember which step we are currently on.
    // It starts at 0, which is the first item in our checklistSteps array.
    let currentStepIndex = 0;

    // --- 4. CORE DISPLAY FUNCTION ---
    /**
     * This function is responsible for updating the modal's display based on the current step.
     * @param {number} index - The index of the step to display from the checklistSteps array.
     */
    function displayStep(index) {
        // Get the specific step object from our array.
        const step = checklistSteps[index];

        // Update the question text and the step counter.
        stepTextElement.textContent = step.text;
        stepCounterElement.textContent = `Step ${index + 1} of ${checklistSteps.length}`;

        // If it's the first step (index 0), hide the "Back" button. Otherwise, show it.
        backButton.style.display = (index === 0) ? 'none' : 'inline-flex';
    
        // If it's the last step, change the button text to "Finish". Otherwise, it says "Next Step".
        nextButton.textContent = (index === checklistSteps.length - 1) ? 'Finish' : 'Next Step';
    }

    // --- 5. EVENT LISTENERS (Adding click behaviors) ---

    // When you click the main card on the dashboard...
    checklistCard.addEventListener('click', () => {
        // Reset the progress to the very first step.
        currentStepIndex = 0;
        // Call our function to display the first step.
        displayStep(currentStepIndex);
        // Add the 'active' class to the modal to make it visible.
        checklistModal.classList.add('active');
    });

    // When you click the "Next" or "Finish" button...
    nextButton.addEventListener('click', () => {
        // --- This block saves the current step's progress ---
        const completedSteps = JSON.parse(localStorage.getItem('completedChecklistSteps')) || [];
        if (!completedSteps.includes(currentStepIndex)) {
            completedSteps.push(currentStepIndex);
        }

        localStorage.setItem('completedChecklistSteps', JSON.stringify(completedSteps));
        updateChecklistProgress();
        // --- End of saving block ---

        if (currentStepIndex < checklistSteps.length - 1) {
        // If we are NOT on the last step, move to the next one
        currentStepIndex++;
        displayStep(currentStepIndex);
        }

        else {
        // If we ARE on the last step, clicking "Finish" closes the modal
        checklistModal.classList.remove('active');
        }

    });

    // When you click the "Back" button...
    backButton.addEventListener('click', () => {
        // Check if we are not on the first step.
        if (currentStepIndex > 0) {
            // If not, decrease the step index by 1.
            currentStepIndex--;
            // Update the modal to show the previous step.
            displayStep(currentStepIndex);
        }
    });

    // When you click the 'X' button to close the modal...
    closeButton.addEventListener('click', () => {
        // Remove the 'active' class to hide the modal.
        checklistModal.classList.remove('active');
    });
}

// This line makes the initOpeningChecklist function available to be imported by app.js.
export default initOpeningChecklist;