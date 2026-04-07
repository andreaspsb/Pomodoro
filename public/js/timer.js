// ─── State Machine ───────────────────────────────────────────────────────────
// States: idle | running | paused | break_running | break_paused

export const CYCLES = {
  classic:     { focus: 25,  shortBreak: 5,  longBreak: 15, label: 'Clássico'    },
  engineering: { focus: 50,  shortBreak: 10, longBreak: 20, label: 'Engenharia'  },
  ultradian:   { focus: 90,  shortBreak: 20, longBreak: 30, label: 'Ultradiano'  },
};

function getDuration(cycle, mode) {
  const c = CYCLES[cycle];
  if (mode === 'shortBreak') return c.shortBreak * 60;
  if (mode === 'longBreak')  return c.longBreak  * 60;
  return c.focus * 60;
}

let state = {
  status:        'idle',    // idle|running|paused|break_running|break_paused
  mode:          'focus',   // focus|shortBreak|longBreak
  cycle:         'classic',
  elapsed:       0,
  total:         25 * 60,
  pomodoroCount: 0,
  bufferUsed:    false,
  startedAt:     null,
};

let _interval = null;

function emit(name, extra = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail: { ...state, ...extra } }));
}

export const getState = () => ({ ...state });

export function setCycle(cycle) {
  if (!CYCLES[cycle]) return;
  state.cycle = cycle;
  if (state.status === 'idle') {
    state.total   = getDuration(cycle, state.mode);
    state.elapsed = 0;
  }
  emit('timer:update');
}

export function setMode(mode) {
  if (state.status !== 'idle') return;
  state.mode    = mode;
  state.total   = getDuration(state.cycle, mode);
  state.elapsed = 0;
  emit('timer:update');
}

export function start() {
  if (!['idle', 'paused', 'break_paused'].includes(state.status)) return;
  if (state.status === 'idle') {
    state.startedAt = new Date().toISOString();
    state.elapsed   = 0;
    state.total     = getDuration(state.cycle, state.mode);
  }
  state.status = state.mode === 'focus' ? 'running' : 'break_running';

  _interval = setInterval(() => {
    state.elapsed++;
    const remaining = state.total - state.elapsed;

    // buffer alert with 2min left in focus
    if (state.mode === 'focus' && remaining === 120 && !state.bufferUsed) {
      emit('timer:buffer-available');
    }
    emit('timer:tick');

    if (state.elapsed >= state.total) _complete();
  }, 1000);

  emit('timer:start');
}

export function pause() {
  if (!['running', 'break_running'].includes(state.status)) return;
  clearInterval(_interval);
  state.status = state.mode === 'focus' ? 'paused' : 'break_paused';
  emit('timer:pause');
}

export function resume() { start(); }

export function reset() {
  clearInterval(_interval);
  state = {
    status: 'idle', mode: state.mode, cycle: state.cycle,
    elapsed: 0, total: getDuration(state.cycle, state.mode),
    pomodoroCount: state.pomodoroCount, bufferUsed: false, startedAt: null,
  };
  emit('timer:reset');
  emit('timer:update');
}

export function skip() {
  clearInterval(_interval);
  if (state.mode === 'focus') {
    state.mode = (state.pomodoroCount + 1) % 4 === 0 ? 'longBreak' : 'shortBreak';
  } else {
    state.mode = 'focus';
  }
  state.status = 'idle'; state.elapsed = 0; state.bufferUsed = false;
  state.total  = getDuration(state.cycle, state.mode);
  emit('timer:skip');
  emit('timer:update');
}

export function extend() {
  if (state.bufferUsed || state.mode !== 'focus') return;
  if (!['running', 'paused'].includes(state.status)) return;
  state.total      += 5 * 60;
  state.bufferUsed  = true;
  emit('timer:extended');
  emit('timer:tick');
}

function _complete() {
  clearInterval(_interval);
  const endedAt = new Date().toISOString();

  if (state.mode === 'focus') {
    state.pomodoroCount++;
    emit('timer:complete', { endedAt });
    state.mode = state.pomodoroCount % 4 === 0 ? 'longBreak' : 'shortBreak';
  } else {
    emit('timer:break-complete', { endedAt });
    state.mode = 'focus';
  }

  state.status = 'idle'; state.elapsed = 0; state.bufferUsed = false;
  state.total  = getDuration(state.cycle, state.mode);
  emit('timer:update');
}
