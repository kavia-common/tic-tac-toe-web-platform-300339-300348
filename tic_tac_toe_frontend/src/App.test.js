import { render, screen, fireEvent, act } from '@testing-library/react';
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
