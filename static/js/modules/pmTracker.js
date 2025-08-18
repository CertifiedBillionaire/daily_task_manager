// pmTracker.js
// Fills the PM table and handles the "Log PM" modal.

// This function provides a basic toast notification.
function showToast(msg, type = "Info") {
  // Use a simple alert since window.showToast is not defined.
  alert(msg);
}

async function getJSON(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error(`GET ${url} failed: ${r.status}`);
  return await r.json();
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  // Read raw text first so we can show useful server errors
  const raw = await r.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // not JSON; keep raw for error display
  }
  if (!r.ok) {
    const msg = (data && data.error) ? data.error : (raw || `POST ${url} failed`);
    throw new Error(msg);
  }
  return data;
}

function $(sel) { return document.querySelector(sel); }

function renderRows(items) {
  const tbody = $("#pmTableBody");
  const empty = $("#pmEmpty");
  tbody.innerHTML = "";
  if (!items || !items.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  for (const row of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:8px 6px;">${row.game_name || ""}</td>
      <td style="padding:8px 6px;">${(row.pm_date || "").toString().slice(0,10)}</td>
      <td style="padding:8px 6px;">${(row.notes || "").replace(/\n/g, "<br>")}</td>
      <td style="padding:8px 6px;">${row.completed_by || ""}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadPMs() {
  const data = await getJSON("/api/pms");
  const items = Array.isArray(data) ? data : (data.items || []);
  renderRows(items);
}

async function loadGamesIntoSelect() {
  const sel = $("#pmGame");
  if (!sel) return;
  sel.innerHTML = `<option value="">-- Select a Game --</option>`;
  try {
    const data = await getJSON("/api/games");
    const items = Array.isArray(data) ? data : (data.items || data.games || []);
    for (const g of items) {
      const id = g.id ?? g.game_id ?? g[0];
      const name = g.name ?? g.game_name ?? g[1] ?? String(id);
      if (id == null) continue;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  } catch (err) {
    console.error("Failed to load games:", err);
    sel.innerHTML += `<option value="">(Failed to load games)</option>`;
  }
}

function openModal() {
  const modal = $("#pmModal");
  if (modal) modal.style.display = "block";
}

function closeModal() {
  const modal = $("#pmModal");
  if (modal) modal.style.display = "none";
}

async function init() {
  $("#btnOpenPmModal")?.addEventListener("click", async () => {
    await loadGamesIntoSelect();
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    $("#pmDate").value = `${today.getFullYear()}-${m}-${d}`;
    openModal();
  });
  $("#pmClose")?.addEventListener("click", closeModal);
  $("#pmCancel")?.addEventListener("click", closeModal);

  $("#pmForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      pmGame: $("#pmGame").value,
      pmDate: $("#pmDate").value,
      pmNotes: $("#pmNotes").value,
      pmCompletedBy: $("#pmCompletedBy").value,
    };
    if (!payload.pmGame || !payload.pmDate) {
      alert("Please select a game and date.");
      return;
    }
    try {
      await postJSON("/api/pms/add", payload);
      alert("PM saved successfully!");
      closeModal();
      await loadPMs();
    } catch (err) {
      console.error(err);
      alert("Failed to save PM: " + err.message);
    }
  });

  await loadPMs();
  await loadPMStatus();
}

async function loadPMStatus() {
  try {
    const data = await getJSON("/api/pms/last_by_game");
    const items = Array.isArray(data) ? data : (data.items || []);
    renderPMStatus(items);
  } catch (e) {
    console.error(e);
  }
}

function renderPMStatus(items) {
  const list = document.querySelector("#pmStatusList");
  if (!list) return;
  const cDue  = document.querySelector("#pmCountDue");
  const cSoon = document.querySelector("#pmCountSoon");
  const cOk   = document.querySelector("#pmCountOk");

  let due = 0, soon = 0, ok = 0;
  list.innerHTML = "";

  for (const it of items) {
    if (it.status === "due") due++;
    else if (it.status === "soon") soon++;
    else ok++;

    const badgeStyle =
      it.status === "due"
        ? "background:#fee2e2; border:1px solid #fecaca;"
        : it.status === "soon"
        ? "background:#fef9c3; border:1px solid #fde68a;"
        : "background:#dcfce7; border:1px solid #bbf7d0;";

    const last = it.last_pm_date ? it.last_pm_date : "—";
    const days = it.days_since != null ? `${it.days_since}d` : "—";

    const row = document.createElement("div");
    row.style = `display:flex; justify-content:space-between; align-items:center; padding:8px; border-radius:8px; ${badgeStyle}`;
    row.innerHTML = `
      <div style="display:flex; flex-direction:column;">
        <div style="font-weight:600;">${it.game_name || "Unknown"}</div>
        <div style="font-size:12px; opacity:.8;">Last PM: ${last} • Days since: ${days}</div>
      </div>
      <div style="font-weight:600; text-transform:uppercase;">${it.status}</div>
    `;
    list.appendChild(row);
  }

  if (cDue)  cDue.textContent  = `Due: ${due}`;
  if (cSoon) cSoon.textContent = `Soon: ${soon}`;
  if (cOk)   cOk.textContent   = `OK: ${ok}`;
}

document.addEventListener("DOMContentLoaded", init);