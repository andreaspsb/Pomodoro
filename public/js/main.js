import {
  start, pause, resume, reset, skip, extend,
  setCycle, setMode, getState,
} from './timer.js';
import {
  updateDisplay, updateDots,
  showSuggestion, hideSuggestion,
  showBuffer, hideBuffer,
  setSyncStatus, setSyncCodeDisplay,
} from './ui.js';
import { getSettings, saveSettings, getSyncCode, setSyncCode } from './settings.js';
import { recordSession, getHistory, registerUser, linkDevice, flushQueue } from './history.js';
import { playAlert, testAlert } from './sounds.js';
import { CYCLES } from './timer.js';
import {
  loadBlockedDomains, addDomains, removeDomain,
  clearAllDomains, exportAsHosts, exportForUBlock,
} from './blocker.js';

// ─── Init ─────────────────────────────────────────────────────────────────────────────────
async function init() {
  const settings = getSettings();
  setCycle(settings.cycle);
  updateDisplay();
  updateDots(0);
  populateSettingsForm(settings);
  await initSync();
  await loadAndRenderBlockedDomains();
  bindTimerEvents();
  bindButtons();
  bindModals();
  bindSettingsForm();
  bindBlockerPanel();
  window.addEventListener('online', () => flushQueue());
}

// ─── Sync bootstrap ───────────────────────────────────────────────────────────
async function initSync() {
  let code = getSyncCode();
  if (!code) {
    try {
      setSyncStatus('syncing');
      const res = await registerUser();
      setSyncCode(res.syncCode);
      code = res.syncCode;
      setSyncStatus('synced');
    } catch {
      setSyncStatus('offline');
    }
  } else {
    setSyncStatus('synced');
  }
  setSyncCodeDisplay(code);
}

// ─── Timer events ─────────────────────────────────────────────────────────────
function bindTimerEvents() {
  window.addEventListener('timer:tick',             () => updateDisplay());
  window.addEventListener('timer:start',            () => updateDisplay());
  window.addEventListener('timer:pause',            () => updateDisplay());
  window.addEventListener('timer:update',           () => updateDisplay());
  window.addEventListener('timer:reset',            () => { updateDisplay(); hideSuggestion(); hideBuffer(); });
  window.addEventListener('timer:skip',             () => { updateDisplay(); hideSuggestion(); hideBuffer(); });
  window.addEventListener('timer:extended',         () => { updateDisplay(); hideBuffer(); });
  window.addEventListener('timer:buffer-available', () => showBuffer());

  window.addEventListener('timer:complete', async (e) => {
    const settings = getSettings();
    _triggerAlert(settings);

    // Record session
    const { cycle, total, startedAt, bufferUsed } = e.detail;
    await recordSession({
      cycleType:   cycle,
      mode:        'focus',
      durationMin: Math.round(total / 60),
      completed:   true,
      extended:    bufferUsed,
      startedAt,
      endedAt: new Date().toISOString(),
    });

    updateDisplay();
    updateDots(e.detail.pomodoroCount);
    showSuggestion(settings.activeCategories);
    hideBuffer();
  });

  window.addEventListener('timer:break-complete', () => {
    const settings = getSettings();
    _triggerAlert(settings);
    hideSuggestion();
    updateDisplay();
  });
}

function _triggerAlert(settings) {
  playAlert(settings.alertStyle, settings.volume);
  if (Notification.permission === 'granted') {
    new Notification('🍅 Meu Pomodoro', {
      body:   'Sessão concluída! Hora de descansar.',
      silent: settings.alertStyle === 'silent',
    });
  }
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
function bindButtons() {
  document.getElementById('btn-start').addEventListener('click', () => {
    const { status } = getState();
    if (['running','break_running'].includes(status))  pause();
    else if (['paused','break_paused'].includes(status)) resume();
    else start();
  });
  document.getElementById('btn-reset').addEventListener('click', reset);
  document.getElementById('btn-skip').addEventListener('click', skip);
  document.getElementById('btn-buffer').addEventListener('click', () => extend());

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  document.getElementById('btn-history').addEventListener('click', openHistory);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function bindModals() {
  // Close buttons
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
  document.getElementById('btn-close-history').addEventListener('click',  closeHistory);

  // Overlay click
  document.querySelectorAll('.modal__overlay').forEach(el => {
    el.addEventListener('click', () => { closeSettings(); closeHistory(); });
  });

  // Keyboard ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSettings(); closeHistory(); }
  });

  // Modal inner tabs (settings)
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('[data-pane]').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-pane="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Period tabs (history)
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      await loadHistory(tab.dataset.period);
    });
  });
}

function openSettings()  {
  document.getElementById('modal-settings').hidden = false;
  document.body.classList.add('modal-open');
}
function closeSettings() {
  document.getElementById('modal-settings').hidden = true;
  document.body.classList.remove('modal-open');
}
async function openHistory() {
  document.getElementById('modal-history').hidden = false;
  document.body.classList.add('modal-open');
  await loadHistory('today');
}
function closeHistory()  {
  document.getElementById('modal-history').hidden = true;
  document.body.classList.remove('modal-open');
}

// ─── History panel ────────────────────────────────────────────────────────────
async function loadHistory(period) {
  setSyncStatus('syncing');
  const data = await getHistory(period);
  setSyncStatus(getSyncCode() ? 'synced' : 'offline');

  document.getElementById('stat-pomodoros').textContent = data.totalPomodoros;
  document.getElementById('stat-minutes').textContent   = data.totalFocusMinutes;
  document.getElementById('stat-streak').textContent    = data.streak;

  // Simple bar chart
  const chart = document.getElementById('history-chart');
  chart.innerHTML = '';
  if (!data.sessions.length) {
    chart.innerHTML = '<p class="chart-empty">Nenhuma sessão registrada neste período.</p>';
    return;
  }
  // Group by day
  const byDay = {};
  data.sessions.forEach(s => {
    const day = new Date(s.ended_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const max = Math.max(...Object.values(byDay), 1);
  Object.entries(byDay).slice(-7).forEach(([day, count]) => {
    const pct = Math.round((count / max) * 100);
    chart.innerHTML += `
      <div class="bar-item">
        <div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div>
        <span class="bar-label">${count}</span>
        <span class="bar-day">${day}</span>
      </div>`;
  });
}

// ─── Settings form ────────────────────────────────────────────────────────────
function populateSettingsForm(settings) {
  // Cycle radios
  document.querySelectorAll('[name="cycle"]').forEach(r => {
    r.checked = r.value === settings.cycle;
  });
  // Alert style
  document.querySelectorAll('[name="alertStyle"]').forEach(r => {
    r.checked = r.value === settings.alertStyle;
  });
  // Volume
  const vol = document.getElementById('volume-slider');
  if (vol) { vol.value = settings.volume; updateVolumeLabel(settings.volume); }
  // Categories
  document.querySelectorAll('[name="category"]').forEach(cb => {
    cb.checked = settings.activeCategories.includes(cb.value);
  });
}

function updateVolumeLabel(v) {
  const lbl = document.getElementById('volume-label');
  if (lbl) lbl.textContent = `${v}%`;
}

function bindSettingsForm() {
  // Cycle
  document.querySelectorAll('[name="cycle"]').forEach(r => {
    r.addEventListener('change', () => {
      const s = getSettings();
      s.cycle = r.value;
      saveSettings(s);
      setCycle(r.value);
      updateDisplay();
    });
  });

  // Alert style
  document.querySelectorAll('[name="alertStyle"]').forEach(r => {
    r.addEventListener('change', () => {
      const s = getSettings(); s.alertStyle = r.value; saveSettings(s);
    });
  });

  // Volume
  const vol = document.getElementById('volume-slider');
  if (vol) {
    vol.addEventListener('input', () => {
      const s = getSettings(); s.volume = Number(vol.value); saveSettings(s);
      updateVolumeLabel(vol.value);
    });
  }

  // Test sound
  document.getElementById('btn-test-sound')?.addEventListener('click', () => {
    const s = getSettings();
    testAlert(s.alertStyle, s.volume);
  });

  // Categories
  document.querySelectorAll('[name="category"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const s = getSettings();
      s.activeCategories = [...document.querySelectorAll('[name="category"]:checked')].map(c => c.value);
      saveSettings(s);
    });
  });

  // Notification permission
  document.getElementById('btn-notify')?.addEventListener('click', async () => {
    await Notification.requestPermission();
  });

  // Sync — link device
  document.getElementById('btn-link-device')?.addEventListener('click', async () => {
    const input = document.getElementById('link-code-input');
    const msg   = document.getElementById('link-msg');
    if (!input?.value.trim()) return;
    try {
      msg.textContent = 'Vinculando…';
      const res = await linkDevice(input.value.trim());
      setSyncCode(res.syncCode);
      setSyncCodeDisplay(res.syncCode);
      msg.textContent = '✅ Dispositivo vinculado com sucesso!';
      msg.className   = 'link-msg link-msg--ok';
      await flushQueue();
    } catch (err) {
      msg.textContent = `❌ ${err.message}`;
      msg.className   = 'link-msg link-msg--err';
    }
  });
}

// ─── Blocker panel ─────────────────────────────────────────────────────────────

let _allDomains = [];

async function loadAndRenderBlockedDomains() {
  _allDomains = await loadBlockedDomains();
  renderBlockerList(_allDomains);
  updateBlockerCount(_allDomains.length);
}

function renderBlockerList(domains) {
  const list   = document.getElementById('blocker-list');
  const search = document.getElementById('blocker-search')?.value.trim().toLowerCase() ?? '';
  if (!list) return;
  const filtered = search ? domains.filter(d => d.includes(search)) : domains;
  list.innerHTML = filtered.map(d => `
    <li class="blocker-item" data-domain="${d}">
      <span class="blocker-item__domain">${d}</span>
      <button class="blocker-item__remove" data-remove="${d}" aria-label="Remover ${d}" title="Remover">✕</button>
    </li>`).join('');

  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      _allDomains = await removeDomain(btn.dataset.remove);
      renderBlockerList(_allDomains);
      updateBlockerCount(_allDomains.length);
    });
  });
}

function updateBlockerCount(n) {
  const el = document.getElementById('blocker-count');
  if (el) el.textContent = `${n} site${n !== 1 ? 's' : ''} bloqueado${n !== 1 ? 's' : ''}`;
}

function bindBlockerPanel() {
  // Add domains textarea
  document.getElementById('btn-blocker-add')?.addEventListener('click', async () => {
    const ta = document.getElementById('blocker-input');
    if (!ta?.value.trim()) return;
    _allDomains = await addDomains(ta.value);
    ta.value = '';
    renderBlockerList(_allDomains);
    updateBlockerCount(_allDomains.length);
  });

  // Search filter
  document.getElementById('blocker-search')?.addEventListener('input', () => {
    renderBlockerList(_allDomains);
  });

  // Export hosts
  document.getElementById('btn-blocker-export-hosts')?.addEventListener('click', () => {
    exportAsHosts(_allDomains);
  });

  // Export uBlock
  document.getElementById('btn-blocker-export-ublock')?.addEventListener('click', async () => {
    await exportForUBlock(_allDomains);
    const btn = document.getElementById('btn-blocker-export-ublock');
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = '✅ Copiado!';
      setTimeout(() => { btn.textContent = prev; }, 2000);
    }
  });

  // Clear all
  document.getElementById('btn-blocker-clear')?.addEventListener('click', async () => {
    if (!confirm('Limpar toda a lista de sites bloqueados?')) return;
    _allDomains = await clearAllDomains();
    renderBlockerList(_allDomains);
    updateBlockerCount(_allDomains.length);
  });

  // Reload blocker list when the Bloqueios tab is opened
  document.querySelector('[data-tab="blocker"]')?.addEventListener('click', async () => {
    await loadAndRenderBlockedDomains();
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
init();

