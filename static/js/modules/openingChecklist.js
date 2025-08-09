// =========================================================================
// ARCADE MANAGER - OPENING CHECKLIST MODULE
// =========================================================================
import { openModal, closeModal } from './modal.js';
import { getKitchenChecklistHTML } from '/static/js/modules/kitchenChecklist.js';
import { createSafetyChecklistHTML, safetyChecklistItems } from './safetySecurityChecklist.js';
import { createBathroomChecklistHTML, bathroomChecklistItems } from './bathroomChecklist.js';
import { getMenuBoardChecklistHTML } from './menuBoardChecklist.js';
import { saveChecklistStepData } from './checklistData.js';
import { getKioskChecklistHTML } from './kioskChecklist.js';
import { getThankYouBoxChecklistHTML } from './thankYouBoxChecklist.js';
import { getAdventureZoneChecklistHTML } from './adventureZoneChecklist.js';
import { getGameRoomChecklistHTML } from './gameRoomChecklist.js';









export const checklistSteps = [
    {
        "title": "Instructions",
        "text": "Welcome to the Opening Duties Checklist. Use this guide to ensure all daily tasks are completed. Your progress is saved automatically and resets daily."
    },
    {
        "title": "TPT Goals",
        "text": "Print the TPT sheet to track goals and review payout information."
    },
    {
        "title": "Tools and Resources",
        "text": "Retrieve the Tech tablet. Use it to log game room issues, track preventative maintenance (PMs), and order parts."
    },
    {
        "title": "Electrical",
        "text": "Activate all required breakers for the day, including those for the kitchen, tech room, showroom, and backrooms."
    },
    {
        "title": "Safety & Security",
        "text": "Conduct a full safety and security inspection. Verify alarms, locks, and lighting. Inspect all carpets, tiles, tables, and chairs, ensuring all hardware is secure."
    },
    {
        "title": "Emergency Lighting",
        "text": "Verify that all emergency lighting batteries are charged. If an issue is found, report it with a specific location (e.g., \"above Pirates Hook game\")."
    },
    {
        "title": "Showroom",
        "text": "Perform a dance floor integrity check. Document any issues discovered."
    },
    {
        "title": "Chuck E. Suit Inspection",
        "text": "Inspect the Chuck E. suit for any tears, rips, or damage to its components (e.g., eyes, ears, teeth), ensuring it is in good condition."
    },
    {
        "title": "Cleaning Resources",
        "text": "Verify that all vacuums are operational."
    },
    {
        "title": "Bathrooms",
        "text": "Inspect bathrooms for any facility issues, including toilet battery status, sinks, paint, locks, and hardware."
    },
    {
        "title": "Tech Ready for Day",
        "text": "Restart the Point of Sale (POS) system."
    },
    {
        "title": "Inspection",
        "text": "Inspect menu boards and the surrounding front counter area. Check that boards are on, lights work, and there are no facility issues like paint chips or damaged borders."
    },
    {
        "title": "Kiosks",
        "text": "Verify kiosk operations and document any issues."
    },
    {
        "title": "Thank You Boxes",
        "text": "Confirm that thank-you boxes are properly stocked, with no missing items, and that the doors are locked."
    },
    {
        "title": "Kitchen",
        "text": "Inspect all kitchen equipment and verify its operational status."
    },
    {
        "title": "Top Up",
        "text": "Top up and add points onto staff card."
    },
    {
        "title": "Adventure Zone",
        "text": "Complete the Adventure Zone inspection. Verify its safety, cleanliness, and lighting."
    },
    {
        "title": "Game Room Check",
        "text": "Conduct a game room inspection to ensure the cleanliness and integrity of floors, games, booths, tables, and thank-you boxes."
    },
    {
        "title": "Daily Tap",
        "text": "Complete the morning game tap procedure."
    }
];

// This function updates the dashboard card's progress display.
export function updateChecklistProgress() {
    const checklistCardProgress = document.querySelector('#startOpeningChecklist .card-progress');
    if (!checklistCardProgress) return;
    const completedSteps = JSON.parse(localStorage.getItem('completedChecklistSteps')) || [];
    const totalSteps = checklistSteps.length;
    checklistCardProgress.textContent = `${completedSteps.length}/${totalSteps} Done`;
}

// The main initialization function for the checklist.
export function initOpeningChecklist() {
    // We get the modal by its correct ID string.
    const CHECKLIST_MODAL_ID = 'opening-checklist-modal'; 
    const checklistModal = document.getElementById(CHECKLIST_MODAL_ID);    
    const nextButton = document.getElementById('checklistNextButton');        
    const backButton = document.getElementById('checklistBackButton');        
    const stepTextElement = document.getElementById('checklistStepText');     
    const stepCounterElement = document.getElementById('checklistStepCounter');
    const checklistResponseArea = document.getElementById('checklistResponseArea');
    const breakersChecklist = document.getElementById('breakersChecklist');
    const safetyChecklistArea = document.getElementById('safetyChecklistArea');
    const emergencyLightingChecklist = document.getElementById('emergencyLightingChecklist');
    const danceFloorChecklist = document.getElementById('danceFloorChecklist');
    const suitInspectionChecklist = document.getElementById('suitInspectionChecklist');
    const cleaningResourcesChecklist = document.getElementById('cleaningResourcesChecklist');
    const bathroomChecklistArea = document.getElementById('bathroomChecklistArea');
    const tptSheetPrintedCheckbox = document.getElementById('tptSheetPrinted');
    const tptNotesGroup = document.getElementById('tptNotesGroup');
    const posRestartChecklist = document.getElementById('posRestartChecklist');
    const menuBoardChecklistArea = document.getElementById('menuBoardChecklistArea');
    const kioskChecklistArea = document.getElementById('kioskChecklistArea');
    const thankYouBoxChecklistArea = document.getElementById('thankYouBoxChecklistArea');
    const kitchenChecklistArea = document.getElementById('kitchenChecklistArea');
    const adventureZoneChecklistArea = document.getElementById('adventureZoneChecklistArea');
    const gameRoomChecklistArea = document.getElementById('gameRoomChecklistArea');
    const dailyTapPlaceholderArea = document.getElementById('dailyTapPlaceholderArea');
    const startOpeningChecklistCard = document.getElementById('startOpeningChecklist');

    // Check localStorage on initialization and apply 'completed' class if needed
    const isCompleted = localStorage.getItem('isOpeningChecklistCompleted');
    if (isCompleted === 'true' && startOpeningChecklistCard) {
        startOpeningChecklistCard.classList.add('completed');
        console.log("Opening Checklist card loaded as completed from localStorage."); // For debugging
    }









    if (!checklistModal || !nextButton || !backButton || !stepTextElement || !stepCounterElement) {
        console.error("Checklist Error: One or more required HTML elements were not found.");
        return null; // Return null to prevent further errors in app.js
    }

    let currentStepIndex = 0;

    function displayStep(index) {
        const step = checklistSteps[index];
        stepTextElement.textContent = step.text;
        stepCounterElement.textContent = `Step ${index + 1} of ${checklistSteps.length}`;
        backButton.style.display = (index === 0) ? 'none' : 'inline-flex';
        nextButton.textContent = (index === checklistSteps.length - 1) ? 'Finish' : 'Next Step';

        // --- UPDATED LOGIC HERE ---
        // This is the new, cleaned-up logic to show and hide the correct checklist
        // We set the innerHTML for the safety checklist when we get to it.
        if (index === 1) { // This is the TPT Goals step
            checklistResponseArea.style.display = 'block';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
        } else if (index === 3) { // This is the Electrical Breakers step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'block';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
        } else if (index === 4) { // This is the Safety & Security step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'block';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            safetyChecklistArea.innerHTML = createSafetyChecklistHTML();
        } else if (index === 5) { // This is the Emergency Lighting step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'block';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
        } else if (index === 6) { // This is the Showroom / Dance Floor step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'block';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
        } else if (index === 7) { // This is the Chuck E. Suit Inspection step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'block';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
        } else if (index === 8) { // This is the Cleaning Resources step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'block';
            bathroomChecklistArea.style.display = 'none';
        } else if (index === 9) { // This is the Bathrooms step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'block';
            bathroomChecklistArea.innerHTML = createBathroomChecklistHTML();
        } else if (index === 10) { // This is the POS Restart step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'block';
        }
        else if (index === 11) { // This is the Menu Boards step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'block';
            menuBoardChecklistArea.innerHTML = getMenuBoardChecklistHTML();
            kioskChecklistArea.style.display = 'none';
            thankYouBoxChecklistArea.style.display = 'none';
            kitchenChecklistArea.style.display = 'none';
        }
        else if (index === 12) { // This is the Kiosks step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'block'; // Show our new container
            kioskChecklistArea.innerHTML = getKioskChecklistHTML(); // Populate it
        }

        else if (index === 13) { // This is the Thank You Boxes step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'none';
            thankYouBoxChecklistArea.style.display = 'block';
            thankYouBoxChecklistArea.innerHTML = getThankYouBoxChecklistHTML();
        }

        else if (index === 14) { // This is the Kitchen step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'none';
            thankYouBoxChecklistArea.style.display = 'none';
            kitchenChecklistArea.style.display = 'block';
            kitchenChecklistArea.innerHTML = getKitchenChecklistHTML();
        }

        else if (index === 16) { // This is the Adventure Zone step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'none';
            thankYouBoxChecklistArea.style.display = 'none';
            kitchenChecklistArea.style.display = 'none';
            adventureZoneChecklistArea.style.display = 'block';
            adventureZoneChecklistArea.innerHTML = getAdventureZoneChecklistHTML();
        }

        else if (index === 17) { // This is the Game Room Check step
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'none';
            thankYouBoxChecklistArea.style.display = 'none';
            kitchenChecklistArea.style.display = 'none';
            adventureZoneChecklistArea.style.display = 'none';
            gameRoomChecklistArea.style.display = 'block';
            gameRoomChecklistArea.innerHTML = getGameRoomChecklistHTML();
        }

        else if (index === 18) { // This is the Daily Tap step
            // Hide all other checklists
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'none';
            thankYouBoxChecklistArea.style.display = 'none';
            kitchenChecklistArea.style.display = 'none';
            adventureZoneChecklistArea.style.display = 'none';
            gameRoomChecklistArea.style.display = 'none';

            // Show our placeholder and add a message to it
            dailyTapPlaceholderArea.style.display = 'block';
            dailyTapPlaceholderArea.innerHTML = `
                <div style="text-align: center; padding: 20px; background-color: #2c3e50; border-radius: 8px;">
                    <p style="margin: 0; font-size: 1.1em; color: #ecf0f1;">This task is completed on a different card.</p>
                    <p style="margin: 5px 0 0; font-size: 0.9em; color: #95a5a6;">This step is a final reminder.</p>
                </div>
            `;
        }

        
        else {
            // For all other steps, hide all of the interactive checklists
            checklistResponseArea.style.display = 'none';
            breakersChecklist.style.display = 'none';
            safetyChecklistArea.style.display = 'none';
            emergencyLightingChecklist.style.display = 'none';
            danceFloorChecklist.style.display = 'none';
            suitInspectionChecklist.style.display = 'none';
            cleaningResourcesChecklist.style.display = 'none';
            bathroomChecklistArea.style.display = 'none';
            posRestartChecklist.style.display = 'none';
            menuBoardChecklistArea.style.display = 'none';
            kioskChecklistArea.style.display = 'none'; 
            thankYouBoxChecklistArea.style.display = 'none';
            kitchenChecklistArea.style.display = 'none';
            adventureZoneChecklistArea.style.display = 'none';
            gameRoomChecklistArea.style.display = 'none'; 
            dailyTapPlaceholderArea.style.display = 'none';
            
        }
        // --- END UPDATED LOGIC ---
    }

    nextButton.addEventListener('click', () => {

        // This one function now handles saving for all steps.
        saveChecklistStepData(currentStepIndex);

        const completedSteps = JSON.parse(localStorage.getItem('completedChecklistSteps')) || [];
        if (!completedSteps.includes(currentStepIndex)) {
            completedSteps.push(currentStepIndex);
        }
        localStorage.setItem('completedChecklistSteps', JSON.stringify(completedSteps));
        
        updateChecklistProgress(); 

        if (currentStepIndex < checklistSteps.length - 1) {
            currentStepIndex++;
            displayStep(currentStepIndex);
        } else {
            closeModal(CHECKLIST_MODAL_ID); 
                        // Get a reference to the dashboard card itself
            const startOpeningChecklistCard = document.getElementById('startOpeningChecklist');
            if (startOpeningChecklistCard) {
                startOpeningChecklistCard.classList.add('completed');
                console.log("Opening Checklist card marked as completed."); // For debugging
            }
                        // Save the card's completed status to localStorage
            localStorage.setItem('isOpeningChecklistCompleted', 'true');
            console.log("Opening Checklist completion status saved to localStorage."); // For debugging
            // --- END NEW CODE ---
        }
    });

    backButton.addEventListener('click', () => {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            displayStep(currentStepIndex);
        }
    });
    
    if (tptSheetPrintedCheckbox && tptNotesGroup) {
        tptSheetPrintedCheckbox.addEventListener('change', () => {
            if (tptSheetPrintedCheckbox.checked) {
                tptNotesGroup.style.display = 'none';
            } else {
                tptNotesGroup.style.display = 'block';
            }
        });
        tptNotesGroup.style.display = tptSheetPrintedCheckbox.checked ? 'none' : 'block';
    }
    
    function openChecklistModal() {
        console.log("Checklist modal element found:", checklistModal);
        
        if (tptSheetPrintedCheckbox && tptNotesGroup) {
            tptNotesGroup.style.display = tptSheetPrintedCheckbox.checked ? 'none' : 'block';
        }

        currentStepIndex = 0;
        displayStep(currentStepIndex);
        openModal(CHECKLIST_MODAL_ID); 
    }

    return { openChecklistModal };
}