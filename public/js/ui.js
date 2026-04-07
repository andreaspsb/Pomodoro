import { getState, CYCLES } from './timer.js';
import { getSuggestion }    from './suggestions.js';

const C = 2 * Math.PI * 88; // SVG ring circumference ≈ 553

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const el = {
  time:       $('timer-time'),
  cycleLabel: $('timer-cycle'),
  ring:       $('ring-progress'),
  btnStart:   $('btn-start'),
  btnReset:   $('btn-reset'),
  btnSkip:    $('btn-skip'),
  btnBuffer:  $('btn-buffer'),
  suggestion: $('suggestion-card'),
  sugIcon:    $('suggestion-icon'),
  sugText:    $('suggestion-text'),
  sugCat:     $('suggestion-category'),
  pomDots:    $('pomodoro-dots'),
  syncBadge:  $('sync-badge'),
  syncCodeEl: $('sync-code-display'),
};

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Main display update ──────────────────────────────────────────────────────
export function updateDisplay() {
  const s = getState();
  const remaining = Math.max(0, s.total - s.elapsed);
  const progress  = s.elapsed / (s.total || 1);

  // Time
  el.time.textContent = fmt(remaining);

  // Ring
  el.ring.style.strokeDashoffset = C * (1 - progress);

  // Cycle label
  el.cycleLabel.textContent = CYCLES[s.cycle]?.label || s.cycle;

  // Document title
  const modeNames = { focus: 'Foco', shortBreak: 'Pausa Curta', longBreak: 'Pausa Longa' };
  document.title = `${fmt(remaining)} — ${modeNames[s.mode]} | Meu Pomodoro`;

  // Body data-mode → CSS accent vars
  document.body.dataset.mode = s.mode;

  // Start button
  const running = ['running', 'break_running'].includes(s.status);
  const paused  = ['paused',  'break_paused' ].includes(s.status);
  if (running) {
    el.btnStart.innerHTML = '<span class="btn__icon">⏸</span> Pausar';
  } else if (paused) {
    el.btnStart.innerHTML = '<span class="btn__icon">▶</span> Continuar';
  } else {
    el.btnStart.innerHTML = '<span class="btn__icon">▶</span> Iniciar';
  }

  // Mode tabs
  $$('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === s.mode);
    t.disabled = s.status !== 'idle';
  });
}

// ─── Pomodoro dots ────────────────────────────────────────────────────────────
export function updateDots(count) {
  el.pomDots.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) {
      const sep = document.createElement('span');
      sep.className = 'dot-sep';
      el.pomDots.appendChild(sep);
    }
    const d = document.createElement('span');
    d.className = `dot${i < (count % 8 || (count > 0 && count % 8 === 0 ? 8 : 0)) ? ' dot--on' : ''}`;
    el.pomDots.appendChild(d);
  }
}

// ─── Suggestion card ──────────────────────────────────────────────────────────
export function showSuggestion(activeCategories) {
  const s = getSuggestion(activeCategories);
  if (!s) return;
  el.sugIcon.textContent = s.icon;
  el.sugText.textContent = s.text;
  el.sugCat.textContent  = s.label;
  el.suggestion.hidden   = false;
  el.suggestion.classList.remove('fade-in');
  requestAnimationFrame(() => el.suggestion.classList.add('fade-in'));
}

export function hideSuggestion() {
  el.suggestion.hidden = true;
  el.suggestion.classList.remove('fade-in');
}

// ─── Buffer button ────────────────────────────────────────────────────────────
export function showBuffer()  { el.btnBuffer.hidden = false; }
export function hideBuffer()  { el.btnBuffer.hidden = true;  }

// ─── Sync badge ───────────────────────────────────────────────────────────────
export function setSyncStatus(status) {
  if (!el.syncBadge) return;
  const map = { synced: '● Sincronizado', syncing: '⟳ Sincronizando…', offline: '○ Offline' };
  el.syncBadge.textContent    = map[status] || '';
  el.syncBadge.dataset.status = status;
}

export function setSyncCodeDisplay(code) {
  if (el.syncCodeEl) el.syncCodeEl.textContent = code || '—';
}
