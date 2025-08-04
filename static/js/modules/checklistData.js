// daily_task_manager/static/js/modules/checklistData.js

// We need to import the lists of items for the checklists
import { safetyChecklistItems } from './safetySecurityChecklist.js';
import { bathroomChecklistItems } from './bathroomChecklist.js';


/**
 * This function handles all the data saving for each checklist step.
 * It is called by the nextButton listener in openingChecklist.js
 * @param {number} stepIndex - The index of the current checklist step.
 */
export function saveChecklistStepData(stepIndex) {
    // This switch statement looks at the step number and runs the correct saving job
    switch (stepIndex) {
        // TPT Goals (Step 2)
        case 1: {
            const tptSheetPrinted = document.getElementById('tptSheetPrinted').checked;
            const tptNotes = document.getElementById('tptNotes').value;
            const gamesOutOfRangeCount = document.getElementById('gamesOutOfRangeInput').value;
            const dailyTpt = document.getElementById('dailyTptInput').value;
            const weeklyAverageTpt = document.getElementById('weeklyAverageTptInput').value;
            const date = new Date().toISOString();
            const tptData = {
                date: date,
                printed: tptSheetPrinted,
                notes: tptNotes,
                gamesOutOfRange: gamesOutOfRangeCount,
                dailyTpt: dailyTpt,
                weeklyAverageTpt: weeklyAverageTpt
            };
            localStorage.setItem('tptGoalsData', JSON.stringify(tptData));
            console.log("TPT data saved:", tptData);
            break;
        }

        // Breakers (Step 4) - No saving needed, so we do nothing.
        case 3:
            break;

        // Safety & Security (Step 5)
        case 4: {
            const date = new Date().toISOString();
            const safetyData = [];
            safetyChecklistItems.forEach(item => {
                const sanitizedName = item.name.replace(/\s/g, '');
                const isChecked = document.getElementById(`safety-${sanitizedName}-ok`).checked;
                const notes = document.getElementById(`safety-${sanitizedName}-notes`).value;
                safetyData.push({
                    item: item.name,
                    status: isChecked ? 'OK' : 'Issue Found',
                    notes: notes,
                });
            });
            localStorage.setItem('safetyData', JSON.stringify(safetyData));
            console.log("Safety data saved:", safetyData);
            break;
        }

        // Emergency Lighting (Step 6)
        case 5: {
            const isLightingOK = document.getElementById('lightingOK').checked;
            const notes = document.getElementById('lightingNotes').value;
            const date = new Date().toISOString();
            const lightingData = {
                date: date,
                status: isLightingOK ? 'OK' : 'Issue Found',
                notes: notes
            };
            localStorage.setItem('emergencyLightingData', JSON.stringify(lightingData));
            console.log("Emergency Lighting data saved:", lightingData);
            break;
        }

        // Dance Floor Integrity (Step 7)
        case 6: {
            const isDanceFloorOK = document.getElementById('danceFloorOK').checked;
            const notes = document.getElementById('danceFloorNotes').value;
            const date = new Date().toISOString();
            const danceFloorData = {
                date: date,
                status: isDanceFloorOK ? 'OK' : 'Issue Found',
                notes: notes
            };
            localStorage.setItem('danceFloorData', JSON.stringify(danceFloorData));
            console.log("Dance Floor data saved:", danceFloorData);
            break;
        }

        // Chuck E. Suit Inspection (Step 8)
        case 7: {
            const isTearsRipsOK = document.getElementById('suitTearsRips').checked;
            const isComponentsOK = document.getElementById('suitComponents').checked;
            const notes = document.getElementById('suitNotes').value;
            const date = new Date().toISOString();
            const suitInspectionData = {
                date: date,
                tearsRipsStatus: isTearsRipsOK ? 'OK' : 'Issue Found',
                componentsStatus: isComponentsOK ? 'OK' : 'Issue Found',
                notes: notes
            };
            localStorage.setItem('suitInspectionData', JSON.stringify(suitInspectionData));
            console.log("Suit inspection data saved:", suitInspectionData);
            break;
        }

        // Cleaning Resources (Step 9)
        case 8: {
            const isVacuumsOK = document.getElementById('vacuumsOK').checked;
            const notes = document.getElementById('vacuumsNotes').value;
            if (!isVacuumsOK || notes) {
                const date = new Date().toISOString();
                const cleaningData = {
                    date: date,
                    status: isVacuumsOK ? 'OK' : 'Issue Found',
                    notes: notes
                };
                localStorage.setItem('cleaningResourcesData', JSON.stringify(cleaningData));
                console.log("Cleaning Resources data saved:", cleaningData);
            }
            break;
        }

        // Bathrooms (Step 10)
        case 9: {
            const date = new Date().toISOString();
            const bathroomData = [];
            bathroomChecklistItems.forEach(item => {
                const sanitizedName = item.name.replace(/\s/g, '');
                const isChecked = document.getElementById(`bathroom-${sanitizedName}-ok`).checked;
                const notes = document.getElementById(`bathroom-${sanitizedName}-notes`).value;
                if (!isChecked || notes) {
                    bathroomData.push({
                        item: item.name,
                        status: isChecked ? 'OK' : 'Issue Found',
                        notes: notes,
                    });
                }
            });
            if (bathroomData.length > 0) {
                localStorage.setItem('bathroomData', JSON.stringify(bathroomData));
                console.log("Bathroom data saved:", bathroomData);
            }
            break;
        }

        // Menu Boards (Step 12)

        // Menu Boards (Step 12)
        case 11: {
            const date = new Date().toISOString();

            // Get values from the NEW checklist items
            const powerOK = document.getElementById('menu-board-power-cb').checked;
            const contentOK = document.getElementById('menu-board-content-cb').checked;
            const facilityOK = document.getElementById('menu-board-facility-cb').checked;
            const promosOK = document.getElementById('menu-board-promo-cb').checked;
            const hasIssue = document.getElementById('menu-board-issue-cb').checked;
            const notes = document.getElementById('menu-board-notes').value;

            const menuBoardData = {
                date: date,
                powerOK: powerOK,
                contentOK: contentOK,
                facilityOK: facilityOK,
                promosOK: promosOK,
                issueReported: hasIssue,
                notes: notes
            };

            localStorage.setItem('menuBoardData', JSON.stringify(menuBoardData));
            console.log("Menu Board data saved:", menuBoardData);
            break;
        }

        // Kiosks (Step 13)
        case 12: {
            const date = new Date().toISOString();
            
            // Get values from the Kiosk checklist items
            const powerOK = document.getElementById('kiosk-power-cb').checked;
            const screenOK = document.getElementById('kiosk-screen-cb').checked;
            const readerOK = document.getElementById('kiosk-reader-cb').checked;
            const printerOK = document.getElementById('kiosk-printer-cb').checked;
            const hasIssue = document.getElementById('kiosk-issue-cb').checked;
            const notes = document.getElementById('kiosk-notes').value;

            const kioskData = {
                date: date,
                powerOK: powerOK,
                screenOK: screenOK,
                readerOK: readerOK,
                printerOK: printerOK,
                issueReported: hasIssue,
                notes: notes
            };
            
            localStorage.setItem('kioskData', JSON.stringify(kioskData));
            console.log("Kiosk data saved:", kioskData);
            break;
        }


         // Thank You Boxes (Step 14)
        case 13: {
            const hasIssue = document.getElementById('box-issue-cb').checked;
            const notes = document.getElementById('box-notes').value;

            // Only save data if an issue is reported or a note is made
            if (hasIssue || notes) {
                const date = new Date().toISOString();
                const isStocked = document.getElementById('box-stocked-cb').checked;
                const itemsOK = document.getElementById('box-items-ok-cb').checked;
                const isLocked = document.getElementById('box-locked-cb').checked;

                const thankYouBoxData = {
                    date: date,
                    isStocked: isStocked,
                    itemsOK: itemsOK,
                    isLocked: isLocked,
                    issueReported: hasIssue,
                    notes: notes
                };

                localStorage.setItem('thankYouBoxData', JSON.stringify(thankYouBoxData));
                console.log("Thank You Box issue saved:", thankYouBoxData);
            }
            break;
        }

        // Kitchen (Step 15)
        case 14: {
            const isOperational = document.getElementById('kitchen-operational-cb').checked;
            const notes = document.getElementById('kitchen-notes').value;

            // Only save data if the box is NOT checked or a note is made
            if (!isOperational || notes) {
                const date = new Date().toISOString();
                const kitchenData = {
                    date: date,
                    isOperational: isOperational,
                    notes: notes
                };
                
                localStorage.setItem('kitchenData', JSON.stringify(kitchenData));
                console.log("Kitchen issue saved:", kitchenData);
            }
            break;
        }

                // Adventure Zone (Step 17)
        case 16: {
            const isSafe = document.getElementById('azone-safety-cb').checked;
            const isClean = document.getElementById('azone-clean-cb').checked;
            const isLit = document.getElementById('azone-lighting-cb').checked;
            const hasIssue = document.getElementById('azone-issue-cb').checked;
            const notes = document.getElementById('azone-notes').value;

            // Only save data if any box is unchecked, an issue is reported, or a note is made
            if (!isSafe || !isClean || !isLit || hasIssue || notes) {
                const date = new Date().toISOString();
                const adventureZoneData = {
                    date: date,
                    isSafe: isSafe,
                    isClean: isClean,
                    isLit: isLit,
                    issueReported: hasIssue,
                    notes: notes
                };
                
                localStorage.setItem('adventureZoneData', JSON.stringify(adventureZoneData));
                console.log("Adventure Zone issue saved:", adventureZoneData);
            }
            break;
        }
        // Game Room Check (Step 18)
        case 17: {
            const floorsOK = document.getElementById('gameroom-floors-cb').checked;
            const gamesOK = document.getElementById('gameroom-games-cb').checked;
            const trashOK = document.getElementById('gameroom-gametrash-cb').checked;
            const boothsOK = document.getElementById('gameroom-booths-cb').checked;
            const hasIssue = document.getElementById('gameroom-issue-cb').checked;
            const notes = document.getElementById('gameroom-notes').value;

            // Only save if a standard check failed, an issue was reported, or a note was made
            if (!floorsOK || !gamesOK || !trashOK || !boothsOK || hasIssue || notes) {
                const date = new Date().toISOString();
                const gameRoomData = {
                    date: date,
                    floorsOK: floorsOK,
                    gamesOK: gamesOK,
                    trashOK: trashOK,
                    boothsOK: boothsOK,
                    issueReported: hasIssue,
                    notes: notes
                };
                
                localStorage.setItem('gameRoomData', JSON.stringify(gameRoomData));
                console.log("Game Room closing issue saved:", gameRoomData);
            }
            break;
        }



        
        // This is a safety catch for any steps that don't need saving
        default:
            break;
    }
}