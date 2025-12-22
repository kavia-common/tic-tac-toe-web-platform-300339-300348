import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { loadScoreboard, saveScoreboard, clearScoreboard } from './storage';
import { loadSettings, saveSettings } from './settingsStorage';
import { getHistory, addEntry as addHistoryEntry, clearHistory as clearHistoryStorage } from './historyStorage';

/**
 * Ocean Professional Theme
 * primary: #2563EB (blue-600)
 * secondary/success: #F59E0B (amber-500)
 * error: #EF4444 (red-500)
 * background: #f9fafb
 * surface: #ffffff
 * text: #111827
 * subtle gradient: from blue to gray
 */

// Helpers
const emptyBoard = () => Array(9).fill(null);
const WIN_LINES = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // cols
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6],
];

function calculateWinner(squares) {
  for (const [a, b, c] of WIN_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { player: squares[a], line: [a, b, c] };
    }
  }
  return null;
}

function getAvailableMoves(squares) {
  return squares
    .map((v, i) => (v === null ? i : null))
    .filter((v) => v !== null);
}

/**
 * AI strategies by difficulty
 */
function aiMoveEasy(squares) {
  const avail = getAvailableMoves(squares);
  if (!avail.length) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

// Normal: win, block, center, corners, sides
function aiMoveNormal(squares, aiSymbol, humanSymbol) {
  const avail = getAvailableMoves(squares);

  // Try to win
  for (const i of avail) {
    const temp = [...squares];
    temp[i] = aiSymbol;
    if (calculateWinner(temp)?.player === aiSymbol) return i;
  }
  // Try to block
  for (const i of avail) {
    const temp = [...squares];
    temp[i] = humanSymbol;
    if (calculateWinner(temp)?.player === humanSymbol) return i;
  }
  // Center
  if (avail.includes(4)) return 4;

  // Corners
  const corners = [0, 2, 6, 8].filter((i) => avail.includes(i));
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

  // Sides
  const sides = [1, 3, 5, 7].filter((i) => avail.includes(i));
  if (sides.length) return sides[Math.floor(Math.random() * sides.length)];

  return null;
}

// Hard: a lightweight minimax for Tic Tac Toe (solvable). Depth-prioritized scoring.
function aiMoveHard(squares, aiSymbol, humanSymbol) {
  const winnerInfo = calculateWinner(squares);
  if (winnerInfo) return null;
  const avail = getAvailableMoves(squares);
  if (!avail.length) return null;

  // Score: +10 win for AI, -10 win for human, 0 draw
  function evaluate(board) {
    const w = calculateWinner(board);
    if (w?.player === aiSymbol) return 10;
    if (w?.player === humanSymbol) return -10;
    return 0;
  }

  function minimax(board, depth, isMax) {
    const score = evaluate(board);
    if (score !== 0) return score - depth * Math.sign(score); // prefer quicker wins / slower losses
    if (getAvailableMoves(board).length === 0) return 0;

    if (isMax) {
      let best = -Infinity;
      for (const i of getAvailableMoves(board)) {
        const b = [...board];
        b[i] = aiSymbol;
        best = Math.max(best, minimax(b, depth + 1, false));
      }
      return best;
    } else {
      let best = Infinity;
      for (const i of getAvailableMoves(board)) {
        const b = [...board];
        b[i] = humanSymbol;
        best = Math.min(best, minimax(b, depth + 1, true));
      }
      return best;
    }
  }

  let bestScore = -Infinity;
  let bestMove = null;

  // Prefer center and corners when scores tie
  const prefer = [4, 0, 2, 6, 8, 1, 3, 5, 7].filter((i) => avail.includes(i));
  for (const i of prefer) {
    const b = [...squares];
    b[i] = aiSymbol;
    const score = minimax(b, 0, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove ?? aiMoveNormal(squares, aiSymbol, humanSymbol);
}

/**
 * Small inline audio assets (tiny data URIs) to avoid external files.
 * Each is a very short tone/chime encoded as wav via base64.
 * Preloaded once and reused. Kept subtle to match theme.
 *
 * Note: These are short valid WAVs. Playback is guarded by canPlayType checks.
 */
const SFX = {
  // Minimal valid WAVs (very small beeps). If unsupported, playback will be skipped safely.
  move: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCwAAACABAAZGF0YQAAAAAAAP8AAP8AAAAA/wA=",
  win:  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCwAAACABAAZGF0YQAAAAAAAP8AAAAAAP8AAP8A",
  draw: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCwAAACABAAZGF0YQAAAAAAAP8AAP8AAP8A",
  reset:"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCwAAACABAAZGF0YQAAAAAAAP8AAAAA/wAAAP8A"
};

// PUBLIC_INTERFACE
function Square({ value, onClick, isWinning, disabled, index }) {
  /** A single Tic Tac Toe square. */
  const label = value ? `Cell ${index + 1}: ${value}` : `Cell ${index + 1}: empty`;
  return (
    <button
      className={`ttt-square ${isWinning ? 'ttt-square-win' : ''} ${value ? `ttt-square-${value}` : ''}`}
      onClick={onClick}
      disabled={disabled || Boolean(value)}
      aria-label={label}
    >
      <span className="ttt-square-value">{value}</span>
    </button>
  );
}

// PUBLIC_INTERFACE
function Board({ squares, onPlay, winningLine, isLocked }) {
  /** 3x3 Board displaying 9 squares. */
  const renderSquare = (i) => {
    const isWinning = winningLine?.includes(i);
    return (
      <Square
        key={i}
        index={i}
        value={squares[i]}
        isWinning={isWinning}
        disabled={isLocked}
        onClick={() => onPlay(i)}
      />
    );
  };

  return (
    <div className="ttt-board" role="grid" aria-label="Tic Tac Toe board">
      {squares.map((_, i) => renderSquare(i))}
    </div>
  );
}

// PUBLIC_INTERFACE
function Controls({ mode, setMode, starter, setStarter, onNewRound, onResetScores, muted, onToggleMute }) {
  /** Controls for game mode, starting player, new round, reset scores, and sound toggle. */
  return (
    <div className="ttt-controls">
      <div className="ttt-control-row">
        <label className="ttt-label" htmlFor="mode-select">Game Mode</label>
        <div className="ttt-segmented" role="radiogroup" aria-label="Select game mode">
          <button
            className={`ttt-segment ${mode === 'pvp' ? 'active' : ''}`}
            role="radio"
            aria-checked={mode === 'pvp'}
            onClick={() => setMode('pvp')}
            id="mode-select"
          >
            Player vs Player
          </button>
          <button
            className={`ttt-segment ${mode === 'pvc' ? 'active' : ''}`}
            role="radio"
            aria-checked={mode === 'pvc'}
            onClick={() => setMode('pvc')}
          >
            Player vs Computer
          </button>
        </div>
      </div>

      <div className="ttt-control-row">
        <label className="ttt-label">Who Starts</label>
        <div className="ttt-segmented" role="radiogroup" aria-label="Choose who starts">
          <button
            className={`ttt-segment ${starter === 'X' ? 'active' : ''}`}
            role="radio"
            aria-checked={starter === 'X'}
            onClick={() => setStarter('X')}
          >
            X
          </button>
          <button
            className={`ttt-segment ${starter === 'O' ? 'active' : ''}`}
            role="radio"
            aria-checked={starter === 'O'}
            onClick={() => setStarter('O')}
          >
            O
          </button>
        </div>
      </div>

      <div className="ttt-control-row ttt-actions" aria-label="Round controls">
        <button className="btn btn-primary" onClick={onNewRound}>New Round</button>
        <div style={{ width: 8 }} />
        <button className="btn btn-primary" onClick={onResetScores}>Reset Scores</button>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary"
          onClick={onToggleMute}
          aria-pressed={muted ? 'true' : 'false'}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </div>
  );
}

/**
 * Settings panel for sounds, animations, and AI difficulty.
 */
// PUBLIC_INTERFACE
function SettingsPanel({ open, onToggleOpen, settings, onChange }) {
  /** Accessible settings UI with toggles and select, persisted by parent. */
  return (
    <>
      <div className="settings-wrap">
        <button
          type="button"
          className="settings-trigger"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls="settings-panel"
          onClick={onToggleOpen}
        >
          <span aria-hidden="true">⚙️</span>
          <span>Settings</span>
        </button>
      </div>

      {open && (
        <section
          id="settings-panel"
          className="settings-panel"
          aria-label="Game Settings"
        >
          <div className="settings-row">
            <label className="settings-label" htmlFor="sounds-toggle">Sounds</label>
            <div className="settings-controls">
              <input
                id="sounds-toggle"
                type="checkbox"
                className="switch"
                role="switch"
                aria-checked={settings.soundsOn ? 'true' : 'false'}
                checked={settings.soundsOn}
                onChange={(e) => onChange({ ...settings, soundsOn: e.target.checked })}
              />
            </div>
          </div>

          <div className="settings-row">
            <label className="settings-label" htmlFor="animations-toggle">Animations</label>
            <div className="settings-controls">
              <input
                id="animations-toggle"
                type="checkbox"
                className="switch"
                role="switch"
                aria-checked={settings.animationsOn ? 'true' : 'false'}
                checked={settings.animationsOn}
                onChange={(e) => onChange({ ...settings, animationsOn: e.target.checked })}
              />
            </div>
          </div>

          <div className="settings-row">
            <label className="settings-label" htmlFor="difficulty-select">AI Difficulty</label>
            <div className="settings-controls">
              <select
                id="difficulty-select"
                className="select"
                aria-label="AI Difficulty"
                value={settings.difficulty}
                onChange={(e) => onChange({ ...settings, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// PUBLIC_INTERFACE
function Status({ current, winner, draw, isPvC, aiSymbol, winningLine }) {
  /** Shows current game status with fade/slide transition. */
  let text = '';
  let tone = 'info';
  if (winner) {
    text = `${winner} wins!`;
    tone = 'success';
  } else if (draw) {
    text = 'It’s a draw.';
    tone = 'warning';
  } else {
    const isAITurn = isPvC && current === aiSymbol;
    text = `${current}'s turn${isAITurn ? ' (Computer)' : ''}`;
  }

  return (
    <div className={`ttt-status ttt-status-${tone}`} role="status" aria-live="polite">
      <div className="ttt-status-text">{text}</div>
      {winner && winningLine && (
        <div className="ttt-status-subtle">Winning line: {winningLine.map(i => i + 1).join(' - ')}</div>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE
function Scoreboard({ scores }) {
  /** Displays cumulative round-based scores with subtle transition on change. */
  return (
    <section className="ttt-status" aria-label="Scores">
      <div className="ttt-status-text">Scores</div>
      <div className="ttt-status-subtle">X Wins: {scores.X} • O Wins: {scores.O} • Draws: {scores.draws}</div>
    </section>
  );
}

// PUBLIC_INTERFACE
function HistoryPanel({ open, onToggleOpen, history, onClear }) {
  /** Collapsible history panel listing recent matches newest first. */
  return (
    <>
      <div className="settings-wrap" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="settings-trigger"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls="history-panel"
          onClick={onToggleOpen}
        >
          <span aria-hidden="true">🕒</span>
          <span>Match History</span>
        </button>
      </div>

      {open && (
        <section id="history-panel" className="settings-panel" aria-label="Match History">
          <div className="settings-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-label">Recent Games</div>
            <div className="settings-controls">
              <button className="btn btn-primary" onClick={onClear}>Clear History</button>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="ttt-status-subtle">No games played yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {history.map((h, idx) => {
                const indexLabel = history.length - idx; // 1-based, newest has highest index
                const d = new Date(h.timestamp);
                const when = isNaN(d.getTime()) ? h.timestamp : d.toLocaleString();
                let badgeClass = 'badge-draw';
                let badgeText = 'Draw';
                if (h.winner === 'X') {
                  badgeClass = 'badge-x';
                  badgeText = 'X';
                } else if (h.winner === 'O') {
                  badgeClass = 'badge-o';
                  badgeText = 'O';
                }
                return (
                  <li key={`${h.timestamp}-${idx}`} className="history-row">
                    <span className="history-index">#{indexLabel}</span>
                    <span className={`history-badge ${badgeClass}`} aria-label={`Winner ${badgeText}`}>{badgeText}</span>
                    <span className="history-info">
                      {when} • Moves: {h.moveCount} • Difficulty: {h.difficulty}{h.starter ? ` • Starter: ${h.starter}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

// PUBLIC_INTERFACE
function App() {
  /**
   * Main application: Tic Tac Toe game with PvP and PvC modes.
   * - Smooth transitions and modern UI following Ocean Professional theme.
   * - Highlights winning line and shows status.
   * - Tracks cumulative scores across rounds.
   * - Adds subtle animations and sound effects with a mute toggle.
   * - Records match history with timestamps and settings.
   */
  const [squares, setSquares] = useState(emptyBoard);
  const [mode, setMode] = useState('pvc'); // 'pvp' | 'pvc'
  const [starter, setStarter] = useState('X'); // 'X' | 'O'
  const [xIsNext, setXIsNext] = useState(true);

  // Scores state: cumulative across rounds
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });

  // On first mount, initialize scores from localStorage if available
  useEffect(() => {
    const persisted = loadScoreboard();
    if (persisted) {
      setScores(persisted);
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());

  // Sound mute state derived from settings.soundsOn
  const [muted, setMuted] = useState(() => !settings.soundsOn);

  // History state and visibility
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(() => getHistory());

  // Preload audio refs
  const moveAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const drawAudioRef = useRef(null);
  const resetAudioRef = useRef(null);

  // Helper: safely create Audio only if the format is supported
  const createAudioSafely = (src) => {
    try {
      const el = new Audio();
      if (!el || typeof el.canPlayType !== 'function') return null;

      // Our sources are WAV data URIs. If WAV is not playable, skip creating.
      const support = el.canPlayType('audio/wav');
      if (!support) return null;

      el.src = src;
      el.preload = 'auto';
      el.volume = 0.35;
      return el;
    } catch (_e) {
      return null;
    }
  };

  // Initialize audio elements once
  useEffect(() => {
    moveAudioRef.current = createAudioSafely(SFX.move);
    winAudioRef.current = createAudioSafely(SFX.win);
    drawAudioRef.current = createAudioSafely(SFX.draw);
    resetAudioRef.current = createAudioSafely(SFX.reset);
  }, []);

  // Persist settings when they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Keep muted in sync with settings.soundsOn
  useEffect(() => {
    setMuted(!settings.soundsOn);
  }, [settings.soundsOn]);

  // Toggle .animations-disabled on document body to globally disable transitions/animations
  useEffect(() => {
    const cls = 'animations-disabled';
    if (!settings.animationsOn) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
  }, [settings.animationsOn]);

  const winnerInfo = useMemo(() => calculateWinner(squares), [squares]);
  const winner = winnerInfo?.player ?? null;
  const winningLine = winnerInfo?.line ?? null;

  const availableMoves = useMemo(() => getAvailableMoves(squares), [squares]);
  const draw = !winner && availableMoves.length === 0;

  const currentPlayer = xIsNext ? 'X' : 'O';
  const isPvC = mode === 'pvc';
  const aiSymbol = starter === 'X' ? 'O' : 'X';
  const isAITurn = isPvC && currentPlayer === aiSymbol && !winner && !draw;

  const isGameOver = Boolean(winner) || draw;

  const handleUserMove = (i) => {
    if (squares[i] || isGameOver) return;

    // Prevent human from moving during AI turn in PvC
    if (isPvC && currentPlayer === aiSymbol) return;

    const next = [...squares];
    next[i] = currentPlayer;
    setSquares(next);
    setXIsNext(!xIsNext);
    playSound('move');
  };

  // AI move effect
  useEffect(() => {
    if (!isAITurn) return;

    const timer = setTimeout(() => {
      const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
      let move = null;
      switch (settings.difficulty) {
        case 'easy':
          move = aiMoveEasy(squares);
          break;
        case 'hard':
          move = aiMoveHard(squares, aiSymbol, humanSymbol);
          break;
        case 'normal':
        default:
          move = aiMoveNormal(squares, aiSymbol, humanSymbol);
          break;
      }
      if (move !== null && !squares[move] && !isGameOver) {
        const next = [...squares];
        next[move] = aiSymbol;
        setSquares(next);
        setXIsNext(aiSymbol === 'X' ? false : true);
        playSound('move');
      }
    }, 450); // small delay for UX

    return () => clearTimeout(timer);
  }, [isAITurn, squares, aiSymbol, isGameOver, settings.difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Increment scores when a round concludes + play end sounds
  useEffect(() => {
    if (winner) {
      setScores((prev) => {
        const updated = { ...prev, [winner]: prev[winner] + 1 };
        // persist new scores
        saveScoreboard(updated);
        return updated;
      });
      playSound('win');
    } else if (!winner && draw) {
      setScores((prev) => {
        const updated = { ...prev, draws: prev.draws + 1 };
        // persist new scores
        saveScoreboard(updated);
        return updated;
      });
      playSound('draw');
    }
    // Only trigger when a game ends
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, draw]);

  // Record match history when a game ends
  useEffect(() => {
    if (!isGameOver) return;
    // Count moves made in this game (non-null squares)
    const moveCount = squares.filter(Boolean).length;
    const entry = {
      timestamp: new Date().toISOString(),
      winner: winner ? winner : 'Draw',
      moveCount,
      difficulty: settings.difficulty,
      starter,
    };
    addHistoryEntry(entry);
    // Update local state view to include the newly added entry
    setHistory(getHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver]);

  const resetBoardKeepScores = (newStarter) => {
    setSquares(emptyBoard());
    setXIsNext((newStarter ?? starter) === 'X');
  };

  const resetForStarter = (newStarter) => {
    setSquares(emptyBoard());
    setStarter(newStarter);
    setXIsNext(newStarter === 'X');
  };

  // Reset board when mode changes to keep state consistent (scores persist)
  useEffect(() => {
    resetForStarter(starter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // If starter flips, reset game accordingly (scores persist)
  useEffect(() => {
    resetForStarter(starter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starter]);

  // PUBLIC_INTERFACE
  const handleNewRound = () => {
    // Clear board; preserve scores, preserve current starter
    resetBoardKeepScores(starter);
    playSound('reset');
  };

  // PUBLIC_INTERFACE
  const handleResetScores = () => {
    // Reset all scores and board
    const zeroed = { X: 0, O: 0, draws: 0 };
    setScores(zeroed);
    // clear persisted scoreboard
    clearScoreboard();
    resetForStarter(starter);
    playSound('reset');
  };

  // PUBLIC_INTERFACE
  const handleToggleMute = () => {
    setSettings((prev) => ({ ...prev, soundsOn: !prev.soundsOn }));
  };

  // PUBLIC_INTERFACE
  const handleClearHistory = () => {
    clearHistoryStorage();
    setHistory([]);
  };

  const playSound = (type) => {
    // Respect mute toggle
    if (muted) return;

    const map = {
      move: moveAudioRef.current,
      win: winAudioRef.current,
      draw: drawAudioRef.current,
      reset: resetAudioRef.current,
    };
    const audio = map[type];

    // If unsupported or not initialized, silently skip
    if (!audio || !audio.src) return;

    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Swallow any playback errors (autoplay policy or decoding issues)
        });
      }
    } catch (_e) {
      // ignore playback errors
    }
  };

  return (
    <div className="ocean-app">
      <div className="ocean-background-gradient" aria-hidden="true" />
      <main className="ocean-container">
        <header className="ocean-header">
          <h1 className="ocean-title">Tic Tac Toe</h1>
          <p className="ocean-subtitle">Play locally against a friend or a simple computer opponent.</p>
        </header>

        <Scoreboard scores={scores} />

        <div>
          <SettingsPanel
            open={settingsOpen}
            onToggleOpen={() => setSettingsOpen((v) => !v)}
            settings={settings}
            onChange={setSettings}
          />
        </div>

        <Controls
          mode={mode}
          setMode={setMode}
          starter={starter}
          setStarter={setStarter}
          onNewRound={handleNewRound}
          onResetScores={handleResetScores}
          muted={muted}
          onToggleMute={handleToggleMute}
        />

        <Status
          current={xIsNext ? 'X' : 'O'}
          winner={winner}
          draw={draw}
          isPvC={isPvC}
          aiSymbol={aiSymbol}
          winningLine={winningLine}
        />

        <section className="ocean-surface">
          <Board
            squares={squares}
            onPlay={handleUserMove}
            winningLine={winningLine}
            isLocked={isAITurn || isGameOver}
          />
        </section>

        <HistoryPanel
          open={historyOpen}
          onToggleOpen={() => setHistoryOpen((v) => !v)}
          history={history}
          onClear={handleClearHistory}
        />

        <footer className="ocean-footer">
          <span className="hint">Tip: Use New Round to continue keeping scores, or Reset Scores to start over.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
