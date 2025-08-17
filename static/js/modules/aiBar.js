// static/js/modules/aiBar.js
export function initAiBar() {
  const bar = document.getElementById('aiAskBar');
  const input = document.getElementById('aiAskInput');
  const send = document.getElementById('aiAskSend');
  const spin = document.getElementById('aiAskSpinner');
  const pop = document.getElementById('aiAskPopover');
  if (!bar || !input || !send || !spin || !pop) return;

  function showPopover(text) {
    pop.innerHTML = `
      <div class="ask-reply">${escapeHtml(text || '(No reply)')}</div>
      <div class="ask-actions">
        <button type="button" data-act="copy">Copy</button>
        <button type="button" data-act="close">Close</button>
      </div>`;
    pop.hidden = false;
  }
  function hidePopover(){ pop.hidden = true; pop.innerHTML = ''; }

  function escapeHtml(s='') {
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
                    .replaceAll('>','&gt;').replaceAll('"','&quot;')
                    .replaceAll("'","&#39;");
  }

  async function ask() {
    const prompt = input.value.trim();
    if (!prompt) return;

    send.disabled = true; spin.hidden = false;
    try {
      const context = {
        url: location.pathname,
        page: document.title || '',
        // you can add more, e.g. current status filter on Issue Hub:
        status: document.getElementById('statusFilter')?.value || ''
      };
      const r = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ prompt, context })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      showPopover(j.reply || '(No reply)');
    } catch (e) {
      showPopover('Sorry, that failed. Try again in a moment.');
      console.error(e);
    } finally {
      send.disabled = false; spin.hidden = true;
    }
  }

  send.addEventListener('click', ask);
  input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') ask(); });

  // close / copy in popover
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') hidePopover();
    if (b.dataset.act === 'copy') {
      const txt = pop.querySelector('.ask-reply')?.textContent || '';
      navigator.clipboard.writeText(txt).catch(()=>{});
      b.textContent = 'Copied!';
      setTimeout(()=> b.textContent = 'Copy', 800);
    }
  });

  // click-away to close
  document.addEventListener('click', (e) => {
    if (pop.hidden) return;
    if (bar.contains(e.target) || pop.contains(e.target)) return;
    hidePopover();
  });
}
