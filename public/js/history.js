import { getSyncCode } from './settings.js';

const QUEUE_KEY = 'mpom_queue';
const API       = '/api';

// ─── Queue helpers ────────────────────────────────────────────────────────────
function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function setQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

// ─── Session recording ────────────────────────────────────────────────────────
export async function recordSession(session) {
  const code = getSyncCode();
  if (!code || !navigator.onLine) {
    setQueue([...getQueue(), session]);
    return;
  }
  try {
    const res = await fetch(`${API}/sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Code': code },
      body:    JSON.stringify(session),
    });
    if (!res.ok) throw new Error('api_error');
    await flushQueue(); // flush any pending sessions
  } catch {
    setQueue([...getQueue(), session]);
  }
}

export async function flushQueue() {
  const code = getSyncCode();
  if (!code || !navigator.onLine) return;
  const queue = getQueue();
  if (!queue.length) return;

  const failed = [];
  for (const s of queue) {
    try {
      const res = await fetch(`${API}/sessions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Code': code },
        body:    JSON.stringify(s),
      });
      if (!res.ok) failed.push(s);
    } catch {
      failed.push(s);
    }
  }
  setQueue(failed);
}

// ─── History fetch ────────────────────────────────────────────────────────────
export async function getHistory(period = 'today') {
  const code = getSyncCode();
  if (!code) return { totalPomodoros: 0, totalFocusMinutes: 0, streak: 0, sessions: [] };
  try {
    const res = await fetch(`${API}/sessions?period=${period}`, {
      headers: { 'X-Sync-Code': code },
    });
    if (!res.ok) throw new Error('api_error');
    return await res.json();
  } catch {
    return { totalPomodoros: 0, totalFocusMinutes: 0, streak: 0, sessions: [] };
  }
}

// ─── Sync management ──────────────────────────────────────────────────────────
export async function registerUser() {
  const res = await fetch(`${API}/sync/register`, { method: 'POST' });
  if (!res.ok) throw new Error('Falha ao registrar usuário');
  return res.json(); // { syncCode, userId }
}

export async function linkDevice(syncCode) {
  const res = await fetch(`${API}/sync/link`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ syncCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Sync code inválido');
  }
  return res.json(); // { userId, syncCode }
}
