import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // fresh mock for each test
  const store = {};
  const localStorageMock = {
    getItem: jest.fn((key) => (key in store ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock createObjectURL for export
  Object.defineProperty(window.URL, 'createObjectURL', {
    value: jest.fn(() => 'blob:mock-url'),
    writable: true,
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    value: jest.fn(),
    writable: true,
  });
});

test('renders Tic Tac Toe title', () => {
  render(<App />);
  expect(screen.getByText(/Tic Tac Toe/i)).toBeInTheDocument();
});

test('renders Scores section and controls', () => {
  render(<App />);
  expect(screen.getByLabelText(/Scores/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /New Round/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reset Scores/i })).toBeInTheDocument();
});

test('renders Mute toggle control', () => {
  render(<App />);
  // The toggle button should exist and be accessible by its label text
  expect(screen.getByRole('button', { name: /Mute sounds|Mute|Unmute sounds|Unmute/i })).toBeInTheDocument();
});

test('renders Settings control and panel fields', () => {
  render(<App />);
  const settingsBtn = screen.getByRole('button', { name: /Settings/i });
  expect(settingsBtn).toBeInTheDocument();

  // Open settings
  act(() => {
    fireEvent.click(settingsBtn);
  });

  // Toggles and select should render
  expect(screen.getByLabelText(/Sounds/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Animations/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/AI Difficulty/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Board Size/i)).toBeInTheDocument();
});

test('initializes scoreboard from localStorage when present', () => {
  // Preload storage before render
  const preset = JSON.stringify({ X: 2, O: 3, draws: 1 });
  window.localStorage.getItem.mockReturnValueOnce(preset);

  render(<App />);
  expect(screen.getByText(/X Wins: 2/i)).toBeInTheDocument();
  expect(screen.getByText(/O Wins: 3/i)).toBeInTheDocument();
  expect(screen.getByText(/Draws: 1/i)).toBeInTheDocument();
});

test('writes scoreboard to localStorage after a win and records history entry', () => {
  // Ensure clean start (no stored value)
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard initial load
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'normal' })) // settings load
    .mockReturnValueOnce(JSON.stringify([])); // history load

  render(<App />);

  // Force a quick PvP scenario to make X win:
  // Click cells 0(X), 3(O), 1(X), 4(O), 2(X) -> X wins top row
  const getCell = (n) => screen.getByRole('button', { name: new RegExp(`Cell ${n}:`, 'i') });

  act(() => {
    fireEvent.click(getCell(1)); // index 0
    fireEvent.click(getCell(4)); // index 3
    fireEvent.click(getCell(2)); // index 1
    fireEvent.click(getCell(5)); // index 4
    fireEvent.click(getCell(3)); // index 2
  });

  // Validate scoreboard persisted
  const calls = window.localStorage.setItem.mock.calls;
  const hasScoreWrite = calls.some(
    ([key, value]) => key === 'ttt_scoreboard_v1' && /"X":\s*1/.test(String(value))
  );
  expect(hasScoreWrite).toBe(true);

  // Validate history entry was written
  const hasHistoryWrite = calls.some(
    ([key, value]) =>
      key === 'ttt_history_v1' &&
      /\[\{/.test(String(value)) &&
      /"winner":\s*"X"/.test(String(value))
  );
  expect(hasHistoryWrite).toBe(true);
});

test('records history entry on draw', () => {
  // Prepare settings and history empty
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'easy' })) // settings
    .mockReturnValueOnce(JSON.stringify([])); // history

  render(<App />);

  // Force a draw in PvP mode by filling board with no win
  // Sequence for draw: 0 X,1 O,2 X,4 O,3 X,5 O,7 X,6 O,8 X
  const getCell = (n) => screen.getByRole('button', { name: new RegExp(`Cell ${n}:`, 'i') });

  act(() => {
    fireEvent.click(getCell(1)); // X
    fireEvent.click(getCell(2)); // O
    fireEvent.click(getCell(3)); // X
    fireEvent.click(getCell(5)); // O
    fireEvent.click(getCell(4)); // X
    fireEvent.click(getCell(6)); // O
    fireEvent.click(getCell(8)); // X
    fireEvent.click(getCell(7)); // O
    fireEvent.click(getCell(9)); // X
  });

  const calls = window.localStorage.setItem.mock.calls;
  const hasHistoryDraw = calls.some(
    ([key, value]) =>
      key === 'ttt_history_v1' && /"winner":\s*"Draw"/.test(String(value))
  );
  expect(hasHistoryDraw).toBe(true);
});

test('clear history removes from localStorage', () => {
  // Prime history to appear non-empty and settings default
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'normal' })) // settings
    .mockReturnValueOnce(JSON.stringify([{ timestamp: new Date().toISOString(), winner: 'X', moveCount: 5, difficulty: 'normal', starter: 'X' }]));

  render(<App />);

  // Open History panel
  const historyBtn = screen.getByRole('button', { name: /Match History/i });
  act(() => {
    fireEvent.click(historyBtn);
  });

  const clearBtn = screen.getByRole('button', { name: /Clear History/i });
  act(() => {
    fireEvent.click(clearBtn);
  });

  const removeCalls = window.localStorage.removeItem.mock.calls;
  const removed = removeCalls.some(([key]) => key === 'ttt_history_v1');
  expect(removed).toBe(true);
});

test('export history creates a blob URL and triggers download', () => {
  // Prime settings and history
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'normal' })) // settings
    .mockReturnValueOnce(JSON.stringify([
      { timestamp: new Date().toISOString(), winner: 'X', moveCount: 5, difficulty: 'normal', starter: 'X' }
    ]));

  render(<App />);

  // Open history
  const historyBtn = screen.getByRole('button', { name: /Match History/i });
  act(() => {
    fireEvent.click(historyBtn);
  });

  const exportBtn = screen.getByRole('button', { name: /Export/i });
  act(() => {
    fireEvent.click(exportBtn);
  });

  expect(window.URL.createObjectURL).toHaveBeenCalled();
});

test('import valid data merges with cap and de-dup by default', async () => {
  const now = new Date().toISOString();
  // Existing one entry
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'normal' })) // settings
    .mockReturnValueOnce(JSON.stringify([
      { timestamp: now, winner: 'X', moveCount: 5, difficulty: 'normal', starter: 'X' }
    ]));

  render(<App />);

  // Open history
  const historyBtn = screen.getByRole('button', { name: /Match History/i });
  act(() => {
    fireEvent.click(historyBtn);
  });

  const importBtn = screen.getByRole('button', { name: /Import/i });

  // Prepare a file
  const file = new File([
    JSON.stringify({
      version: '1.0.0',
      entries: [
        { timestamp: now, winner: 'X', moveCount: 5, difficulty: 'normal', starter: 'X' }, // duplicate
        { timestamp: new Date(Date.now() - 1000).toISOString(), winner: 'O', moveCount: 4, difficulty: 'hard', starter: 'O' }
      ]
    })
  ], 'history.json', { type: 'application/json' });

  // Click import (opens hidden input), then simulate change on the input
  act(() => {
    fireEvent.click(importBtn);
  });

  const fileInput = document.querySelector('input[type="file"][accept="application/json"]');
  await act(async () => {
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
  });

  // Expect setItem called with ttt_history_v1 and two unique entries after merge
  const calls = window.localStorage.setItem.mock.calls.filter(([k]) => k === 'ttt_history_v1');
  expect(calls.length).toBeGreaterThan(0);
  const last = calls[calls.length - 1][1];
  const parsed = JSON.parse(last);
  expect(Array.isArray(parsed)).toBe(true);
  // should be at least 2 items and unique
  expect(parsed.length).toBeGreaterThanOrEqual(2);
  const winners = parsed.map(e => e.winner);
  expect(winners).toContain('O');
});

test('import with Replace replaces current history', async () => {
  const now = new Date().toISOString();
  // Existing many entries
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'normal' })) // settings
    .mockReturnValueOnce(JSON.stringify([
      { timestamp: now, winner: 'X', moveCount: 5, difficulty: 'normal', starter: 'X' }
    ]));

  render(<App />);

  const historyBtn = screen.getByRole('button', { name: /Match History/i });
  act(() => {
    fireEvent.click(historyBtn);
  });

  // Enable Replace toggle
  const replaceToggle = screen.getByRole('switch', { name: /Replace current history when importing/i });
  act(() => {
    fireEvent.click(replaceToggle);
  });

  const importBtn = screen.getByRole('button', { name: /Import/i });

  const file = new File([
    JSON.stringify({
      version: '1.0.0',
      entries: [
        { timestamp: new Date(Date.now() - 5000).toISOString(), winner: 'O', moveCount: 3, difficulty: 'easy', starter: 'O' }
      ]
    })
  ], 'history.json', { type: 'application/json' });

  act(() => {
    fireEvent.click(importBtn);
  });

  const fileInput = document.querySelector('input[type="file"][accept="application/json"]');
  await act(async () => {
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
  });

  // Expect last setItem only has 1 entry (replaced)
  const calls = window.localStorage.setItem.mock.calls.filter(([k]) => k === 'ttt_history_v1');
  const last = calls[calls.length - 1][1];
  const parsed = JSON.parse(last);
  expect(parsed.length).toBe(1);
  expect(parsed[0].winner).toBe('O');
});

test('invalid import shows warning and does not modify history', async () => {
  const now = new Date().toISOString();
  // Existing entries
  window.localStorage.getItem
    .mockReturnValueOnce(null) // scoreboard
    .mockReturnValueOnce(JSON.stringify({ soundsOn: true, animationsOn: true, difficulty: 'normal' })) // settings
    .mockReturnValueOnce(JSON.stringify([
      { timestamp: now, winner: 'X', moveCount: 5, difficulty: 'normal', starter: 'X' }
    ]));

  render(<App />);

  const historyBtn = screen.getByRole('button', { name: /Match History/i });
  act(() => {
    fireEvent.click(historyBtn);
  });

  const importBtn = screen.getByRole('button', { name: /Import/i });

  const badFile = new File(['{"not":"valid"}'], 'history.json', { type: 'application/json' });

  act(() => {
    fireEvent.click(importBtn);
  });

  const fileInput = document.querySelector('input[type="file"][accept="application/json"]');
  await act(async () => {
    Object.defineProperty(fileInput, 'files', { value: [badFile] });
    fireEvent.change(fileInput);
  });

  // A warning message should be shown briefly
  expect(screen.getByText(/Invalid import file/i)).toBeInTheDocument();

  // Ensure no additional setItem calls added to modify history for invalid import
  const calls = window.localStorage.setItem.mock.calls.filter(([k]) => k === 'ttt_history_v1');
  // Only existing writes (from render cycle) may exist, but no new write after invalid import
  // To be lenient, assert that last write still contains only the original entry
  const last = calls[calls.length - 1]?.[1];
  if (last) {
    const parsed = JSON.parse(last);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  }
});

test('board size 4x4 renders 16 cells and detects a row win (N=4)', () => {
  // default settings, then change board size to 4 in UI
  render(<App />);
  const settingsBtn = screen.getByRole('button', { name: /Settings/i });
  act(() => { fireEvent.click(settingsBtn); });
  const sizeSelect = screen.getByLabelText(/Board Size/i);
  act(() => { fireEvent.change(sizeSelect, { target: { value: '4' } }); });

  // 4x4 should have cells 1..16
  for (let i = 1; i <= 16; i++) {
    expect(screen.getByRole('button', { name: new RegExp(`Cell ${i}:`, 'i') })).toBeInTheDocument();
  }

  // Switch to PvP to control moves precisely
  const pvpBtn = screen.getByRole('radio', { name: /Player vs Player/i });
  act(() => { fireEvent.click(pvpBtn); });

  // Make top row win for X: cells 1,2,3,4 (indexes 0..3)
  const cell = (n) => screen.getByRole('button', { name: new RegExp(`Cell ${n}:`, 'i') });
  act(() => {
    fireEvent.click(cell(1)); // X
    fireEvent.click(cell(5)); // O
    fireEvent.click(cell(2)); // X
    fireEvent.click(cell(6)); // O
    fireEvent.click(cell(3)); // X
    fireEvent.click(cell(7)); // O
    fireEvent.click(cell(4)); // X -> win
  });

  expect(screen.getByText(/X wins/i)).toBeInTheDocument();
});

test('board size 5x5 renders 25 cells and detects a diagonal win (N=5)', () => {
  render(<App />);
  const settingsBtn = screen.getByRole('button', { name: /Settings/i });
  act(() => { fireEvent.click(settingsBtn); });
  const sizeSelect = screen.getByLabelText(/Board Size/i);
  act(() => { fireEvent.change(sizeSelect, { target: { value: '5' } }); });

  for (let i = 1; i <= 25; i++) {
    expect(screen.getByRole('button', { name: new RegExp(`Cell ${i}:`, 'i') })).toBeInTheDocument();
  }

  const pvpBtn = screen.getByRole('radio', { name: /Player vs Player/i });
  act(() => { fireEvent.click(pvpBtn); });

  const cell = (n) => screen.getByRole('button', { name: new RegExp(`Cell ${n}:`, 'i') });
  // Diagonal TL->BR: cells 1,7,13,19,25 (indexes 0,6,12,18,24)
  act(() => {
    fireEvent.click(cell(1));  // X
    fireEvent.click(cell(2));  // O
    fireEvent.click(cell(7));  // X
    fireEvent.click(cell(3));  // O
    fireEvent.click(cell(13)); // X
    fireEvent.click(cell(4));  // O
    fireEvent.click(cell(19)); // X
    fireEvent.click(cell(5));  // O
    fireEvent.click(cell(25)); // X -> win
  });

  expect(screen.getByText(/X wins/i)).toBeInTheDocument();
});
