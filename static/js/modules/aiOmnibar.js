// static/js/modules/aiOmnibar.js
export function initAiOmnibar({ endpoint = "/api/ai/ask" } = {}) {
  const form   = document.getElementById("ai-omnibar");
  const input  = document.getElementById("aiPrompt");
  const panel  = document.getElementById("aiReplyPanel");
  if (!form || !input || !panel) return;

  function renderLoading(q){
    panel.hidden = false;
    panel.innerHTML = `
      <div class="ai-reply__hd"><i class="fas fa-robot"></i> Assistant</div>
      <div class="ai-reply__body">Thinking about: “${escapeHtml(q)}” …</div>
    `;
  }
  function renderReply(text){
    panel.hidden = false;
    panel.innerHTML = `
      <div class="ai-reply__hd"><i class="fas fa-robot"></i> Assistant</div>
      <div class="ai-reply__body">${linkify(escapeHtml(text || "No reply"))}</div>
      <div class="ai-reply__tools">
        <button type="button" class="ai-chip" data-ai-copy>Copy</button>
        <button type="button" class="ai-chip" data-ai-close>Close</button>
      </div>
    `;
  }
  function renderError(msg){
    panel.hidden = false;
    panel.innerHTML = `
      <div class="ai-reply__hd"><i class="fas fa-robot"></i> Assistant</div>
      <div class="ai-reply__error">${escapeHtml(msg || "Something went wrong.")}</div>
      <div class="ai-reply__tools">
        <button type="button" class="ai-chip" data-ai-close>Close</button>
      </div>
    `;
  }

  function escapeHtml(s=""){
    return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }
  function linkify(s=""){
    return s.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  // Optional: close & copy actions
  panel.addEventListener("click", (e)=>{
    if (e.target?.dataset?.aiClose !== undefined) { panel.hidden = true; }
    if (e.target?.dataset?.aiCopy !== undefined) {
      const text = panel.querySelector(".ai-reply__body")?.innerText || "";
      navigator.clipboard?.writeText(text);
      e.target.textContent = "Copied";
      setTimeout(()=> e.target.textContent="Copy", 1200);
    }
  });

  // Submit handler
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    // Context you can expand any time
    const context = {
      url: location.pathname + location.search,
      page: document.body?.dataset?.page || null
    };

    input.disabled = true;
    form.querySelector(".ai-send")?.setAttribute("disabled","true");
    renderLoading(q);

    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q, context })
      });

      // Fallback demo if backend isn’t wired yet
      if (r.status === 404) {
        await new Promise(res=>setTimeout(res, 500));
        renderReply(`(demo) You asked: ${q}`);
      } else {
        const j = await r.json().catch(()=> ({}));
        if (!r.ok) throw new Error(j.error || "Request failed");
        renderReply(j.reply || "(no reply)");
      }
    } catch (err) {
      renderError(err.message);
    } finally {
      input.value = "";
      input.disabled = false;
      form.querySelector(".ai-send")?.removeAttribute("disabled");
      input.focus();
    }
  });

  // Esc closes the panel
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Escape") panel.hidden = true;
  });
}
