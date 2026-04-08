const $ = id => document.getElementById(id);

const elStatus   = $('status-text');
const elStats    = $('stats');
const elConfig   = $('section-config');
const elError    = $('error-box');
const elCount    = $('stat-count');
const elSync     = $('stat-sync');
const elUrl      = $('input-url');
const elCode     = $('input-code');
const btnSave    = $('btn-save');
const btnSync    = $('btn-sync');
const btnSettings= $('btn-settings');

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { apiUrl, syncCode } = await chrome.storage.sync.get(['apiUrl', 'syncCode']);

  if (apiUrl)  elUrl.value  = apiUrl;
  if (syncCode) elCode.value = syncCode.toUpperCase();

  const configured = !!(apiUrl && syncCode);
  showView(configured ? 'status' : 'config');

  if (configured) await refreshStatus();
}

// ─── Views ────────────────────────────────────────────────────────────────────

function showView(view) {
  elConfig.hidden = (view !== 'config');
  elStats.hidden  = (view !== 'status');
  btnSettings.hidden = (view !== 'status');
}

async function refreshStatus() {
  const status = await sendMessage({ type: 'get-status' });
  if (!status) return;

  if (!status.configured) {
    showView('config');
    return;
  }

  if (status.error) {
    elStatus.textContent = '● Erro de sincronização';
    elStatus.className   = 'popup__status popup__status--error';
    showError(status.error);
  } else {
    elStatus.textContent = '● Ativo';
    elStatus.className   = 'popup__status popup__status--ok';
    elError.hidden = true;
  }

  elCount.textContent = status.count ?? 0;
  elSync.textContent  = status.syncedAt ? timeAgo(status.syncedAt) : '—';
  showView('status');
}

// ─── Botões ───────────────────────────────────────────────────────────────────

btnSave.addEventListener('click', async () => {
  const apiUrl   = elUrl.value.trim().replace(/\/$/, '');
  const syncCode = elCode.value.trim().toUpperCase();

  if (!apiUrl || !syncCode) return;

  btnSave.disabled = true;
  btnSave.textContent = 'Sincronizando…';

  await chrome.storage.sync.set({ apiUrl, syncCode });
  const result = await sendMessage({ type: 'sync' });

  if (result?.ok) {
    await refreshStatus();
  } else {
    showError(result?.error ?? 'Erro desconhecido');
  }

  btnSave.disabled = false;
  btnSave.textContent = 'Salvar e sincronizar';
});

btnSync.addEventListener('click', async () => {
  btnSync.disabled = true;
  btnSync.textContent = '🔄 Sincronizando…';
  await sendMessage({ type: 'sync' });
  await refreshStatus();
  btnSync.disabled = false;
  btnSync.textContent = '🔄 Sincronizar agora';
});

btnSettings.addEventListener('click', () => showView('config'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showError(msg) {
  elError.hidden = false;
  elError.textContent = `❌ ${msg}`;
}

function sendMessage(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, response => resolve(response));
  });
}

function timeAgo(timestamp) {
  const diff = Math.round((Date.now() - timestamp) / 60000);
  if (diff < 1)  return 'agora';
  if (diff < 60) return `${diff} min atrás`;
  const h = Math.round(diff / 60);
  return `${h}h atrás`;
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
