import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

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

// Very simple AI: try win, block, center, corner, side
function computeAIMove(squares, aiSymbol, humanSymbol) {
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

/**
 * Small inline audio assets (tiny data URIs) to avoid external files.
 * Each is a very short tone/chime encoded as wav via base64.
 * Preloaded once and reused. Kept subtle to match theme.
 */
const SFX = {
  move: "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABYAAAASG1hZGUgYnkgQUkAAABkAAAAAAAAgP8AAP8AAID/AAD/AAAA/wAAAP8AAP8AAAD/AAAA/wAAAP8AAAD/AAAA", // soft click (very short)
  win:  "data:audio/wav;base64,UklGRoQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABYAAAASG1hZGUgYnkgQUkAAACEAAAAAAAAgP8AQP8AgP8AQH8AgP8AQH8AgP8AQH8AgP8A", // tiny chime
  draw: "data:audio/wav;base64,UklGRoQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABYAAAASG1hZGUgYnkgQUkAAACEAAAAAAAAgP8AAP8AgP8AAP8AgP8AAP8AgP8AAP8A", // neutral tone
  reset:"data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABYAAAASG1hZGUgYnkgQUkAAABkAAAAAAAAgP8AQH8AAP8AQH8AAP8AQH8AAP8A"  // whoosh-ish blip
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
function App() {
  /**
   * Main application: Tic Tac Toe game with PvP and PvC modes.
   * - Smooth transitions and modern UI following Ocean Professional theme.
   * - Highlights winning line and shows status.
   * - Tracks cumulative scores across rounds.
   * - Adds subtle animations and sound effects with a mute toggle.
   */
  const [squares, setSquares] = useState(emptyBoard);
  const [mode, setMode] = useState('pvc'); // 'pvp' | 'pvc'
  const [starter, setStarter] = useState('X'); // 'X' | 'O'
  const [xIsNext, setXIsNext] = useState(true);

  // Scores state: cumulative across rounds
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });

  // Sound mute state (default unmuted)
  const [muted, setMuted] = useState(false);

  // Preload audio refs
  const moveAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const drawAudioRef = useRef(null);
  const resetAudioRef = useRef(null);

  // Initialize audio elements once
  useEffect(() => {
    moveAudioRef.current = new Audio(SFX.move);
    winAudioRef.current = new Audio(SFX.win);
    drawAudioRef.current = new Audio(SFX.draw);
    resetAudioRef.current = new Audio(SFX.reset);

    // Preload by setting volume low and playing paused on mobile allowed after interaction; here we just set preload
    [moveAudioRef.current, winAudioRef.current, drawAudioRef.current, resetAudioRef.current].forEach(a => {
      a.preload = 'auto';
      a.volume = 0.35;
    });
  }, []);

  const playSound = (type) => {
    if (muted) return;
    const map = {
      move: moveAudioRef.current,
      win: winAudioRef.current,
      draw: drawAudioRef.current,
      reset: resetAudioRef.current
    };
    const audio = map[type];
    if (audio) {
      // Restart sound if already playing
      try {
        audio.currentTime = 0;
        audio.play();
      } catch (e) {
        // ignore playback errors (e.g., autoplay restrictions)
      }
    }
  };

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
      const move = computeAIMove(squares, aiSymbol, aiSymbol === 'X' ? 'O' : 'X');
      if (move !== null && !squares[move] && !isGameOver) {
        const next = [...squares];
        next[move] = aiSymbol;
        setSquares(next);
        setXIsNext(aiSymbol === 'X' ? false : true);
        playSound('move');
      }
    }, 450); // small delay for UX

    return () => clearTimeout(timer);
  }, [isAITurn, squares, aiSymbol, isGameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Increment scores when a round concludes + play end sounds
  useEffect(() => {
    if (winner) {
      setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }));
      playSound('win');
    } else if (!winner && draw) {
      setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
      playSound('draw');
    }
    // Only trigger when a game ends
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, draw]);

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
    setScores({ X: 0, O: 0, draws: 0 });
    resetForStarter(starter);
    playSound('reset');
  };

  // PUBLIC_INTERFACE
  const handleToggleMute = () => {
    setMuted((m) => !m);
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
          current={currentPlayer}
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

        <footer className="ocean-footer">
          <span className="hint">Tip: Use New Round to continue keeping scores, or Reset Scores to start over.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
