const SETTINGS_KEY = 'ttt_settings_v1';

/**
 * Validate a raw settings object, applying defaults for missing/invalid fields.
 */
function normalizeSettings(raw) {
  const defaults = {
    soundsOn: true,
    animationsOn: true,
    difficulty: 'normal', // 'easy' | 'normal' | 'hard'
    boardSize: 3, // 3 | 4 | 5
  };
  if (!raw || typeof raw !== 'object') return defaults;

  const soundsOn = typeof raw.soundsOn === 'boolean' ? raw.soundsOn : defaults.soundsOn;
  const animationsOn = typeof raw.animationsOn === 'boolean' ? raw.animationsOn : defaults.animationsOn;
  const difficulty = ['easy', 'normal', 'hard'].includes(raw.difficulty) ? raw.difficulty : defaults.difficulty;
  const boardSize = [3, 4, 5].includes(raw.boardSize) ? raw.boardSize : defaults.boardSize;

  return { soundsOn, animationsOn, difficulty, boardSize };
}

// PUBLIC_INTERFACE
export function loadSettings() {
  /** Load persisted settings from localStorage. Returns normalized object. */
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return normalizeSettings(null);
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch (_e) {
    return normalizeSettings(null);
  }
}

// PUBLIC_INTERFACE
export function saveSettings(settings) {
  /** Persist settings to localStorage after normalization. */
  try {
    const normalized = normalizeSettings(settings);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (_e) {
    // ignore
    return null;
  }
}
