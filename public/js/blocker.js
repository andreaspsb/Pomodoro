const API_BASE      = '/api/blocked-sites';
const STORAGE_KEY   = 'mpom_blocked_sites';
const SETTINGS_KEY  = 'mpom_settings';

// ─── Overlay element (injected after DOM ready) ───────────────────────────────
let _overlay = null;

export function initOverlay() {
  _overlay = document.getElementById('blocker-overlay');
}

export function showBlockerOverlay() {
  if (!_overlay) return;
  _overlay.hidden = false;
  void _overlay.offsetWidth; // reflow para disparar animação
  _overlay.classList.add('blocker-overlay--visible');
}

export function hideBlockerOverlay() {
  if (!_overlay) return;
  _overlay.classList.remove('blocker-overlay--visible');
  setTimeout(() => { if (_overlay) _overlay.hidden = true; }, 350);
}

// ─── Sync-code helper ─────────────────────────────────────────────────────────

function syncHeaders() {
  const code = localStorage.getItem('mpom_sync_code');
  return code ? { 'Content-Type': 'application/json', 'X-Sync-Code': code } : null;
}

// ─── Domain normalizer ────────────────────────────────────────────────────────

export function normalizeDomain(raw) {
  try {
    const s = raw.trim().toLowerCase();
    const withProto = s.startsWith('http') ? s : `https://${s}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function loadBlockedDomains() {
  const headers = syncHeaders();
  if (headers) {
    try {
      const res = await fetch(API_BASE, { headers });
      if (res.ok) {
        const { domains } = await res.json();
        _saveLocal(domains);
        return domains;
      }
    } catch { /* fallback */ }
  }
  return _loadLocal();
}

export async function addDomains(rawText) {
  const lines = rawText.split(/[\n,;]+/).map(l => normalizeDomain(l)).filter(Boolean);
  const unique = [...new Set(lines)];
  if (!unique.length) return [];

  const headers = syncHeaders();
  if (headers) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ domains: unique }),
      });
      if (res.ok) {
        const current = await loadBlockedDomains();
        return current;
      }
    } catch { /* fallback */ }
  }

  // Local fallback
  const current = _loadLocal();
  const merged = [...new Set([...current, ...unique])].sort();
  _saveLocal(merged);
  return merged;
}

export async function removeDomain(domain) {
  const headers = syncHeaders();
  if (headers) {
    try {
      await fetch(`${API_BASE}/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers,
      });
    } catch { /* fallback */ }
  }
  const current = _loadLocal().filter(d => d !== domain);
  _saveLocal(current);
  return current;
}

export async function clearAllDomains() {
  const headers = syncHeaders();
  if (headers) {
    try {
      await fetch(API_BASE, { method: 'DELETE', headers });
    } catch { /* fallback */ }
  }
  _saveLocal([]);
  return [];
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function exportAsHosts(domains) {
  const lines = domains.map(d => `0.0.0.0 ${d}`).join('\n');
  const blob = new Blob([lines], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'meu-pomodoro-blocked.hosts';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportForUBlock(domains) {
  const lines = domains.map(d => `||${d}^`).join('\n');
  await navigator.clipboard.writeText(lines);
}

// ─── Block mode listener ──────────────────────────────────────────────────────

let _blockingActive = false;

function _getBlockMode() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw).blockMode ?? 'focus') : 'focus';
  } catch { return 'focus'; }
}

function _handlePageHide() {
  if (!_blockingActive) return;
  showBlockerOverlay();
}

function _handleVisibility() {
  if (!_blockingActive) return;
  // Mostra ao sair da aba; não esconde automaticamente ao voltar
  // — o dismiss é sempre explícito (botão ou deactivateBlocking)
  if (document.hidden) showBlockerOverlay();
}

export function activateBlocking() {
  _blockingActive = true;
  window.addEventListener('blur', _handlePageHide);
  document.addEventListener('visibilitychange', _handleVisibility);
}

export function deactivateBlocking() {
  _blockingActive = false;
  window.removeEventListener('blur', _handlePageHide);
  document.removeEventListener('visibilitychange', _handleVisibility);
  hideBlockerOverlay();
}

/** Chamado no init e ao mudar blockMode — reconfigura listeners conforme o modo */
export function applyBlockMode() {
  const mode = _getBlockMode();
  if (mode === 'always') {
    activateBlocking();
  } else {
    // 'focus' e 'off' — listeners controlados pelos eventos do timer
    deactivateBlocking();
  }
}

// ─── Local storage helpers ────────────────────────────────────────────────────

function _loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveLocal(domains) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
}
