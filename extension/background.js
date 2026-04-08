const SYNC_ALARM   = 'mpom-sync';
const SYNC_MINUTES = 60; // re-sincronizar a cada hora

// ─── Inicialização ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  // Cria alarme de sync periódico
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_MINUTES });
  await syncDomains();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncDomains();
});

// ─── Alarme periódico ─────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM) await syncDomains();
});

// ─── Mensagens do popup ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'sync') {
    syncDomains().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // async
  }
  if (msg.type === 'get-status') {
    getStatus().then(sendResponse);
    return true;
  }
});

// ─── Core: sincronizar domínios ───────────────────────────────────────────────

async function syncDomains() {
  const { apiUrl, syncCode } = await chrome.storage.sync.get(['apiUrl', 'syncCode']);

  if (!apiUrl || !syncCode) {
    await setStatus({ configured: false, count: 0 });
    return;
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/blocked-sites`, {
      headers: { 'X-Sync-Code': syncCode },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { domains } = await res.json();
    await applyBlockingRules(domains);
    await setStatus({ configured: true, count: domains.length, syncedAt: Date.now(), error: null });
  } catch (err) {
    await setStatus({ error: err.message });
    console.error('[Pomodoro Blocker] Sync error:', err);
  }
}

// ─── Aplicar regras declarativeNetRequest ────────────────────────────────────

async function applyBlockingRules(domains) {
  // Remove todas as regras dinâmicas existentes
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  // Monta novas regras — redireciona para blocked.html
  const blockedPage = chrome.runtime.getURL('blocked.html');

  const addRules = domains.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: `${blockedPage}?domain=${encodeURIComponent(domain)}`,
      },
    },
    condition: {
      urlFilter:       `||${domain}^`,
      resourceTypes:   ['main_frame'],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules,
  });
}

// ─── Status helpers ───────────────────────────────────────────────────────────

async function setStatus(patch) {
  const current = await chrome.storage.local.get('status');
  const status  = { ...(current.status || {}), ...patch };
  await chrome.storage.local.set({ status });
}

async function getStatus() {
  const { status } = await chrome.storage.local.get('status');
  return status || {};
}
