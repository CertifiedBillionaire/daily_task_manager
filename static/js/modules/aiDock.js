// static/js/modules/aiDock.js
export function initAiDock({
  endpoint = "/api/ai/ask",
  formSelector = "#ai-omnibar",
  inputSelector = "#aiPrompt"
} = {}) {

  // --- build UI once ---
  const dock = document.createElement("div");
  dock.className = "ai-dock";
  dock.innerHTML = `
    <div class="ai-dock__hd">
      <i class="fas fa-brain" aria-hidden="true"></i>
      <span class="title">Assistant</span>
      <span class="spacer"></span>
      <button type="button" data-act="clear" title="Clear">Clear</button>
      <button type="button" data-act="close" title="Close">Close</button>
    </div>
    <div class="ai-dock__bd" id="aiDockList" role="log" aria-live="polite"></div>
  `;
  document.body.appendChild(dock);

  const fab = document.createElement("button");
  fab.className = "ai-dock__fab";
  fab.innerHTML = `<i class="fas fa-message"></i>`;
  document.body.appendChild(fab);

  const list = dock.querySelector("#aiDockList");

  function openDock() { dock.classList.add("open"); }
  function closeDock() { dock.classList.remove("open"); }
  function toggleDock() { dock.classList.toggle("open"); }

  fab.addEventListener("click", toggleDock);
  dock.querySelector('[data-act="close"]').addEventListener("click", closeDock);
  dock.querySelector('[data-act="clear"]').addEventListener("click", () => { list.innerHTML = ""; });

  dock.classList.add("ai-dock--lg");

  // --- helpers ---
  const esc = (s="") => String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");

  function addMsg(kind, text) {
    const div = document.createElement("div");
    div.className = `ai-msg ${kind}`;
    div.innerHTML = esc(text);
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement("div");
    typingEl.className = "ai-typing";
    typingEl.textContent = "Assistant is typing…";
    list.appendChild(typingEl);
    list.scrollTop = list.scrollHeight;
  }
  function hideTyping() {
    typingEl?.remove();
    typingEl = null;
  }

  // --- wire to your header omnibar form ---
  const form = document.querySelector(formSelector);
  const input = document.querySelector(inputSelector);
  if (!form || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = (input.value || "").trim();
    if (!prompt) return;

    addMsg("user", prompt);
    openDock();
    showTyping();

    try {
      const payload = {
        prompt,
        context: { url: location.pathname, page: document.title }
      };
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(()=>({ reply: "(error parsing reply)" }));
      hideTyping();

      if (!r.ok && j?.error) {
        addMsg("err", `Error: ${j.error}`);
      } else {
        const reply = j.reply || j.text || "(no reply)";
        addMsg("bot", reply);
      }
    } catch (err) {
      hideTyping();
      addMsg("err", err?.message || "Request failed");
    } finally {
      input.value = ""; // keep the input in the header, just clear it
      input.focus();
    }
  });
}
