// static/js/modules/inspectGame.js
// inspectGame.js — chip-by-chip inspector that creates separate issues per category
import { CATEGORIES, PRIORITIES } from './constants.js';

// inspection order + help
const ORDER = [
  { key: 'Safety', help: 'Check sharp edges, loose glass, cords.' },
  { key: 'Power/Boot', help: 'Does it power on? Any boot errors?' },
  { key: 'Reader', help: 'Tap card. Do credits add?' },
  { key: 'Controls', help: 'Start a game. Test buttons/joystick/guns/wheel.' },
  { key: 'Sound', help: 'Audio plays, correct level, no crackle?' },
  { key: 'Screen/Display', help: 'Picture, colors, brightness, no dead pixels?' },
  { key: 'Lights', help: 'Marquee/cabinet/playfield in attract and play?' },
  { key: 'Tickets', help: 'If ticket game: payout/card credit OK?' },
  { key: 'Appearance/Hardware', help: 'Glass, decals, screws, leveling, dust.' }
];

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

let CURRENT_GAME = null;           // { id, name }
let INDEX = 0;                     // step index
let RESULTS = [];                  // {category, choice:'OK'|'NA'|'ISSUE'}
let SKIP_CONTROLS_AND_TICKETS = false;

export function initInspectGame({ openSelector, gamesProvider, onIssueSaved }){
  const modal = $('#inspectGameModal');
  const chipTitle = $('#ig_chipTitle');
  const help = $('#ig_chipHelp');
  const stepInfo = $('#ig_stepInfo');

  // --- game search ---
  const suggest = $('#ig_gameSuggestions');
  $('#ig_gameSearch').addEventListener('input', async (e)=>{
    const q = e.target.value.trim().toLowerCase();
    if(!q){ suggest.style.display='none'; return; }
    const games = await gamesProvider();
    const list = games.filter(g=>g.name.toLowerCase().includes(q)).slice(0,8);
    suggest.innerHTML = list.map(g=>`<div class="suggest" data-id="${g.id}" data-name="${g.name}">${g.name}</div>`).join('');
    suggest.style.display = list.length ? '' : 'none';
  });
  suggest.addEventListener('click', (e)=>{
    const row = e.target.closest('.suggest'); if(!row) return;
    CURRENT_GAME = { id: row.dataset.id, name: row.dataset.name };
    $('#ig_gameSearch').value = CURRENT_GAME.name;
    $('#ig_currentGame').textContent = `Locked: ${CURRENT_GAME.name}`;
    suggest.style.display='none';
  });

  // --- choice buttons ---
  $('#ig_choiceRow').addEventListener('click', (e)=>{
    if(!e.target.classList.contains('chip')) return;
    const choice = e.target.dataset.choice; // OK | ISSUE | NA
    $all('#ig_choiceRow .chip').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');

    // show/hide mini issue form
    $('#ig_issueForm').style.display = (choice==='ISSUE') ? '' : 'none';
    if(choice==='ISSUE'){
      const cat = ORDER[INDEX].key;
      const input = $('#ig_desc');
      if(!input.value) input.value = `${cat} issue`;
      input.focus();
    }
  });

  // priority chips
  $('#ig_priorityChips').addEventListener('click', (e)=>{
    if(!e.target.classList.contains('chip')) return;
    $all('#ig_priorityChips .chip').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
  });

  // controls
  $('#ig_prev').addEventListener('click', ()=> moveStep(-1));
  $('#ig_next').addEventListener('click', ()=> nextStep());
  $('#ig_finish').addEventListener('click', ()=> finishAndReset());

  // open/close
  document.body.addEventListener('click', (e)=>{
    if(e.target.matches(openSelector)){ openModal(); }
    if(e.target.closest('[data-close]')){ closeModal(); }
  });

  function openModal(){
    CURRENT_GAME = null;
    INDEX = 0;
    RESULTS = [];
    SKIP_CONTROLS_AND_TICKETS = false;

    $('#ig_gameSearch').value='';
    $('#ig_currentGame').textContent='';
    $('#ig_issueForm').style.display='none';
    $all('#ig_choiceRow .chip').forEach(b=>b.classList.remove('active'));

    renderStep();
    modal.classList.remove('hidden');
  }

  function closeModal(){ modal.classList.add('hidden'); }

  function renderStep(){
    const total = ORDER.length;
    const step = ORDER[INDEX];
    chipTitle.textContent = step.key;
    help.textContent = step.help;
    stepInfo.textContent = `Step ${INDEX+1} of ${total}`;

    // show/hide finish vs next
    $('#ig_finish').style.display = (INDEX===total-1) ? '' : 'none';
    $('#ig_next').style.display = (INDEX===total-1) ? 'none' : '';
    $('#ig_prev').disabled = (INDEX===0);

    // gate: if Reader was Issue → skip Controls and Tickets
    if((step.key==='Controls' || step.key==='Tickets') && SKIP_CONTROLS_AND_TICKETS){
      RESULTS[INDEX] = { category: step.key, choice: 'NA' };
      if(INDEX < total-1){ INDEX++; renderStep(); return; }
    }

    // reset selection for this step
    $all('#ig_choiceRow .chip').forEach(b=>b.classList.remove('active'));
    $('#ig_issueForm').style.display='none';
    $('#ig_desc').value='';
  }

  function recordIssueIfNeeded(choice){
    const cat = ORDER[INDEX].key;
    RESULTS[INDEX] = { category: cat, choice };

    if(cat==='Reader' && choice==='ISSUE'){
      SKIP_CONTROLS_AND_TICKETS = true;
    }

    if(choice==='ISSUE'){
      const desc = $('#ig_desc').value.trim() || `${cat} issue`;
      const prio = $('#ig_priorityChips .chip.active')?.dataset.val || 'Medium';
      if(!CURRENT_GAME){ alert('Pick a game first.'); return false; }

      // --- NEW CODE HERE: ensure equipment_name (game name) is sent ---
      const payload = {
        type: 'game',
        area: 'Game Room', // (we can wire real area later)
        game_id: CURRENT_GAME.id,
        equipment_name: CURRENT_GAME.name,          // human name
        equipment_location: CURRENT_GAME.name,      // mirror for renderer/old API
        category: cat,
        priority: prio,
        description: desc,
        notes: '',
        status: 'Open'
      };
      // --- END NEW CODE ---

      fetch('/api/issues', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      })
      .then(async (r)=>{
        if(!r.ok) throw new Error(await r.text());
        const saved = await r.json();
        if(typeof onIssueSaved==='function') onIssueSaved(saved);
      })
      .catch(err=> alert('Save failed: '+err.message));
    }
    return true;
  }

  function nextStep(){
    if(!CURRENT_GAME){ alert('Pick a game first.'); return; }
    const active = $('#ig_choiceRow .chip.active')?.dataset.choice;
    if(!active){ alert('Choose: OK, Add Issue, or N/A.'); return; }

    const ok = recordIssueIfNeeded(active);
    if(!ok) return;

    if(INDEX < ORDER.length-1){ INDEX++; renderStep(); }
  }

  function moveStep(delta){
    if(INDEX===0 && delta<0) return;
    INDEX += delta;
    if(INDEX<0) INDEX=0;
    if(INDEX>=ORDER.length) INDEX=ORDER.length-1;
    renderStep();
  }

  function finishAndReset(){
    closeModal();
    // optional: POST "inspected today"
  }
}
