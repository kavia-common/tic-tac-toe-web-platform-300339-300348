const HISTORY_KEY = 'ttt_history_v1';
const MAX_ENTRIES = 50;
const EXPORT_VERSION = '1.0.0';

/**
 * Validate and normalize a single history entry.
 * Entry shape: { timestamp: string(ISO), winner: 'X'|'O'|'Draw', moveCount: number, difficulty: 'easy'|'normal'|'hard', starter?: 'X'|'O' }
 */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const { timestamp, winner, moveCount, difficulty, starter } = raw;

  const isISO = typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp));
  const validWinner = winner === 'X' || winner === 'O' || winner === 'Draw';
  // Allow up to 25 to support up to 5x5 board sizes
  const validMoves = Number.isInteger(moveCount) && moveCount >= 0 && moveCount <= 25;
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
 * Create a stable identifier used for de-duplication, based on key fields.
 * If additional fields are added in the future, include them here to keep IDs stable.
 */
function entryId(e) {
  // Keep simple, deterministic string id
  const starterPart = e.starter ? e.starter : '';
  return `${e.timestamp}|${e.winner}|${e.moveCount}|${e.difficulty}|${starterPart}`;
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

/**
 * Persist a list (already normalized and capped).
 */
function saveList(list) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (_e) {
    // ignore
  }
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
    saveList(updated);
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

/**
 * Validate import payload: supports either an array (legacy) or {version, entries}.
 */
function parseImportPayload(json) {
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    if (Array.isArray(parsed)) {
      // Legacy format: array of entries
      return normalizeList(parsed);
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
      return normalizeList(parsed.entries);
    }
  } catch (_e) {
    // ignore
  }
  return null;
}

// PUBLIC_INTERFACE
export function exportHistoryPayload() {
  /** Build a portable export payload with version for forward compatibility. */
  const entries = getHistory();
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

// PUBLIC_INTERFACE
export function replaceHistoryFromImport(payload) {
  /**
   * Replace current history entirely with the provided payload's entries.
   * Returns { success: boolean, reason?: string }
   */
  const entries = parseImportPayload(payload);
  if (!entries) {
    return { success: false, reason: 'Invalid import format' };
  }
  saveList(entries);
  return { success: true };
}

// PUBLIC_INTERFACE
export function mergeHistoryFromImport(payload) {
  /**
   * Merge imported entries on top of current history (newest first),
   * de-duplicate by computed entryId, and cap to MAX_ENTRIES.
   * Returns { success: boolean, reason?: string }
   */
  const incoming = parseImportPayload(payload);
  if (!incoming) {
    return { success: false, reason: 'Invalid import format' };
  }

  const current = getHistory();
  const seen = new Set(current.map(entryId));

  // Add new entries first (already normalized & sorted newest-first)
  const merged = [];
  for (const e of incoming) {
    const id = entryId(e);
    if (!seen.has(id)) {
      merged.push(e);
      seen.add(id);
    }
  }
  // Then append existing list to keep overall newest-first ordering with imported first
  const result = normalizeList([...merged, ...current]); // normalizeList will cap and ensure order
  saveList(result);
  return { success: true };
}
