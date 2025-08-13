// static/js/modules/addIssueQuick.js
// addIssueQuick.js — controls the Add Issue (Quick) modal
import { AREAS, CATEGORIES, PRIORITIES } from './constants.js';

// tiny helpers
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }
function makeChips(container, items, active=null){
  container.innerHTML = items.map(v =>
    `<button class="chip${v===active?' active':''}" data-val="${v}">${v}</button>`
  ).join('');
}

let LAST_AREA = localStorage.getItem('last_area') || 'Game Room';
let CURRENT_TYPE = 'game';     // 'game' | 'facility'
let CURRENT_GAME = null;       // { id, name }

export function initAddIssueQuick({openButtonSelector, gamesProvider, onSaved}){
  // 1) fill chips
  makeChips($('#categoryChips'), CATEGORIES);
  makeChips($('#priorityChips'), PRIORITIES, 'Medium');

  // 2) areas datalist
  const dl = $('#areaList');
  dl.innerHTML = AREAS.map(a => `<option value="${a}">`).join('');
  $('#areaInput').value = LAST_AREA;

  // 3) issue type chips
  $('#issueTypeChips').addEventListener('click', (e)=>{
    if(!e.target.classList.contains('chip')) return;
    $all('#issueTypeChips .chip').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');

    // --- NEW CODE HERE: show/hide rows based on type ---
    CURRENT_TYPE = e.target.dataset.type; // 'game' or 'facility'
    const isGame = CURRENT_TYPE === 'game';
    $('#gamePickerRow').style.display     = isGame ? '' : 'none';
    const facRow = document.getElementById('facilityEquipRow');
    if (facRow) facRow.style.display      = isGame ? 'none' : '';
    if (!isGame) { CURRENT_GAME = null; $('#gameSearch').value = ''; }
    // --- END NEW CODE ---
  });

  // 4) category / priority chip selection
  ['#categoryChips','#priorityChips'].forEach(sel=>{
    $(sel).addEventListener('click', (e)=>{
      if(!e.target.classList.contains('chip')) return;
      $all(sel+' .chip').forEach(b=>b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // 5) game search with suggestions (uses your API)
  const suggestBox = $('#gameSuggestions');
  $('#gameSearch').addEventListener('input', async (e)=>{
    const q = e.target.value.trim().toLowerCase();
    if(!q){ suggestBox.style.display='none'; return; }
    const games = await gamesProvider();       // expects [{id,name}, ...]
    const list = games.filter(g=>g.name.toLowerCase().includes(q)).slice(0,8);
    suggestBox.innerHTML = list.map(g=>`<div class="suggest" data-id="${g.id}" data-name="${g.name}">${g.name}</div>`).join('');
    suggestBox.style.display = list.length ? '' : 'none';
  });
  suggestBox.addEventListener('click', (e)=>{
    const row = e.target.closest('.suggest'); if(!row) return;
    CURRENT_GAME = { id: row.dataset.id, name: row.dataset.name };
    $('#gameSearch').value = CURRENT_GAME.name;
    suggestBox.style.display='none';
  });

  // 6) area add-if-new
  $('#areaInput').addEventListener('change', ()=>{
    const val = $('#areaInput').value.trim();
    const known = new Set(AREAS.map(a=>a.toLowerCase()));
    if(val && !known.has(val.toLowerCase())){
      if(confirm(`Add "${val}" to Areas?`)){
        const opt = document.createElement('option');
        opt.value = val; $('#areaList').appendChild(opt);
        // optional: POST to backend to persist Areas master list
      } else {
        $('#areaInput').value = LAST_AREA;
      }
    }
  });

  // 7) save handlers
  async function saveIssue(thenStay){
    const area = $('#areaInput').value.trim() || 'Game Room';
    const category = $('#categoryChips .chip.active')?.dataset.val || 'Other';
    const priority = $('#priorityChips .chip.active')?.dataset.val || 'Medium';
    const description = $('#descInput').value.trim();
    const notes = $('#notesInput').value.trim();

    // --- NEW CODE HERE: decide equipment_name + game_id ---
    let equipment_name = null;
    let game_id = null;

    if (CURRENT_TYPE === 'game') {
      if (!CURRENT_GAME) { alert('Pick a game first.'); return; }
      game_id = CURRENT_GAME.id;
      equipment_name = CURRENT_GAME.name; // show this in the Issues table
    } else {
      equipment_name = $('#facilityEquipInput')?.value.trim() || '';
      if (!equipment_name) {
        alert('Add Equipment/Location for facility issue.');
        return;
      }
    }
    // --- END NEW CODE ---

    if(!description){
      alert('Please add a short description.');
      return;
    }

    const payload = {
      type: CURRENT_TYPE,               // 'game' | 'facility'
      area,
      game_id,
      equipment_name,
      equipment_location: equipment_name, // <- mirror for renderer/old API
      category,
      priority,
      description,
      notes,
      status: 'Open'
    };

    // POST to your API
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      const txt = await res.text();
      alert('Save failed: '+txt);
      return;
    }

    // remember last area
    LAST_AREA = area;
    localStorage.setItem('last_area', LAST_AREA);

    const saved = await res.json();
    if(typeof onSaved==='function') onSaved(saved);

    if(thenStay){
      // stay for rapid adds (keep type/game/area)
      $('#descInput').value=''; $('#notesInput').value='';
      $('#descInput').focus();
    } else {
      // close modal
      document.getElementById('addIssueQuickModal').classList.add('hidden');
    }
  }

  $('#saveIssueBtn').addEventListener('click', ()=>saveIssue(false));
  $('#saveAddNextBtn').addEventListener('click', ()=>saveIssue(true));

  // 8) open/close
  document.body.addEventListener('click', (e)=>{
    if(e.target.matches(openButtonSelector)){
      // reset minimal fields only
      $('#descInput').value=''; $('#notesInput').value='';
      // show / hide rows based on the last chosen type
      const isGame = CURRENT_TYPE==='game';
      $('#gamePickerRow').style.display     = isGame ? '' : 'none';
      const facRow = document.getElementById('facilityEquipRow');
      if (facRow) facRow.style.display      = isGame ? 'none' : '';
      document.getElementById('addIssueQuickModal').classList.remove('hidden');
      $('#descInput').focus();
    }
    if(e.target.closest('[data-close]')){
      document.getElementById('addIssueQuickModal').classList.add('hidden');
    }
  });
}
