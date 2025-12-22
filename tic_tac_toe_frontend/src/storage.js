//
// Simple localStorage helper for scoreboard persistence
//
// Provides small wrapper functions to avoid duplicating string keys and to
// centralize JSON parsing/stringifying and error handling.
//

const SCOREBOARD_KEY = 'ttt_scoreboard_v1';

// PUBLIC_INTERFACE
export function loadScoreboard() {
  /** Load persisted scoreboard from localStorage. Returns a validated object or null if not present. */
  try {
    const raw = window.localStorage.getItem(SCOREBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Number.isInteger(parsed.X) &&
      Number.isInteger(parsed.O) &&
      Number.isInteger(parsed.draws)
    ) {
      return parsed;
    }
  } catch (_e) {
    // ignore malformed storage
  }
  return null;
}

// PUBLIC_INTERFACE
export function saveScoreboard(scores) {
  /** Persist scoreboard to localStorage. No-op if scores is invalid. */
  try {
    if (
      scores &&
      typeof scores === 'object' &&
      Number.isInteger(scores.X) &&
      Number.isInteger(scores.O) &&
      Number.isInteger(scores.draws)
    ) {
      window.localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scores));
    }
  } catch (_e) {
    // ignore storage write failures (e.g., privacy mode)
  }
}

// PUBLIC_INTERFACE
export function clearScoreboard() {
  /** Remove scoreboard from localStorage. */
  try {
    window.localStorage.removeItem(SCOREBOARD_KEY);
  } catch (_e) {
    // ignore
  }
}
