// --- NEW FILE ---
// static/js/modules/toast.js
// Tiny toast utility used across modules.

function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  Object.assign(c.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: '9999',
    pointerEvents: 'none'
  });
  return c;
}

export function showToast(message, type = 'success') {
  const container = ensureToastContainer();
  const toast = document.createElement('div');

  const bg = (type === 'error') ? '#991b1b' : (type === 'info') ? '#1f2937' : '#065f46';

  Object.assign(toast.style, {
    background: bg,
    color: '#fff',
    padding: '10px 12px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 8px 24px rgba(0,0,0,.18)',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity .15s ease, transform .15s ease',
    pointerEvents: 'auto'
  });

  toast.textContent = message;
  container.appendChild(toast);

  // animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => container.removeChild(toast), 200);
  }, 2200);
}
