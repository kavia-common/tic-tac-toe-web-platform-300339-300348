const HISTORY_KEY = 'ttt_history_v1';
const MAX_ENTRIES = 50;

/**
 * Validate and normalize a single history entry.
 * Entry shape: { timestamp: string(ISO), winner: 'X'|'O'|'Draw', moveCount: number, difficulty: 'easy'|'normal'|'hard', starter?: 'X'|'O' }
 */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const { timestamp, winner, moveCount, difficulty, starter } = raw;

  const isISO = typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp));
  const validWinner = winner === 'X' || winner === 'O' || winner === 'Draw';
  const validMoves = Number.isInteger(moveCount) && moveCount >= 0 && moveCount <= 9;
  const validDifficulty = ['easy', 'normal', 'hard'].includes(difficulty);
  const validStarter = starter === 'X' || starter === 'O' || starter === undefined;

  if (!isISO || !validWinner || !validMoves || !validDifficulty || !validStarter) return null;

  return {
    timestamp,
    winner,
    moveCount,
    difficulty,
    ...(starter ? { starter } : {}),
  };
}

/**
 * Normalize an array of entries, newest first, trimmed to MAX_ENTRIES.
 */
function normalizeList(raw) {
  if (!Array.isArray(raw)) return [];
  const mapped = raw
    .map(normalizeEntry)
    .filter(Boolean);

  // Ensure newest first by timestamp if possible; otherwise keep order given.
  mapped.sort((a, b) => {
    const ta = Date.parse(a.timestamp);
    const tb = Date.parse(b.timestamp);
    if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
    return tb - ta;
  });

  return mapped.slice(0, MAX_ENTRIES);
}

// PUBLIC_INTERFACE
export function getHistory() {
  /** Retrieve the persisted match history list (newest first). */
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeList(parsed);
  } catch (_e) {
    return [];
  }
}

// PUBLIC_INTERFACE
export function addEntry(entry) {
  /** Add a single match entry, normalize it, keep list newest first, trimmed to max size. */
  try {
    const normalized = normalizeEntry(entry);
    if (!normalized) return;

    const list = getHistory();
    const updated = [normalized, ...list].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (_e) {
    // ignore storage issues
  }
}

// PUBLIC_INTERFACE
export function clearHistory() {
  /** Clear the match history from localStorage. */
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch (_e) {
    // ignore
  }
}
