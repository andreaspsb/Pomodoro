const SETTINGS_KEY  = 'mpom_settings';
const SYNC_CODE_KEY = 'mpom_sync_code';

const DEFAULTS = {
  cycle:            'classic',
  alertStyle:       'gradual',
  volume:           70,
  activeCategories: ['physical', 'creative', 'reflection', 'organize', 'visual'],
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getSyncCode() {
  return localStorage.getItem(SYNC_CODE_KEY) || null;
}

export function setSyncCode(code) {
  localStorage.setItem(SYNC_CODE_KEY, code);
}

export function clearSyncCode() {
  localStorage.removeItem(SYNC_CODE_KEY);
}
