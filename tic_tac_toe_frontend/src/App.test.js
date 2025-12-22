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

test('initializes scoreboard from localStorage when present', () => {
  // Preload storage before render
  const preset = JSON.stringify({ X: 2, O: 3, draws: 1 });
  window.localStorage.getItem.mockReturnValueOnce(preset);

  render(<App />);
  expect(screen.getByText(/X Wins: 2/i)).toBeInTheDocument();
  expect(screen.getByText(/O Wins: 3/i)).toBeInTheDocument();
  expect(screen.getByText(/Draws: 1/i)).toBeInTheDocument();
});

test('writes scoreboard to localStorage after a win', () => {
  // Ensure clean start (no stored value)
  window.localStorage.getItem.mockReturnValueOnce(null);

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

  // After win effect runs, scores should update and be persisted.
  // We cannot assert exact value easily from setItem due to multiple calls, but validate it was called with scoreboard key.
  const calls = window.localStorage.setItem.mock.calls;
  const hasScoreWrite = calls.some(
    ([key, value]) => key === 'ttt_scoreboard_v1' && /"X":\s*1/.test(String(value))
  );
  expect(hasScoreWrite).toBe(true);
});

test('reset scores clears localStorage', () => {
  window.localStorage.getItem.mockReturnValueOnce(JSON.stringify({ X: 5, O: 1, draws: 2 }));
  render(<App />);

  const resetBtn = screen.getByRole('button', { name: /Reset Scores/i });
  act(() => {
    fireEvent.click(resetBtn);
  });

  // Should call removeItem with scoreboard key
  const removeCalls = window.localStorage.removeItem.mock.calls;
  const removed = removeCalls.some(([key]) => key === 'ttt_scoreboard_v1');
  expect(removed).toBe(true);

  // UI should reflect zeroed scores
  expect(screen.getByText(/X Wins: 0/i)).toBeInTheDocument();
  expect(screen.getByText(/O Wins: 0/i)).toBeInTheDocument();
  expect(screen.getByText(/Draws: 0/i)).toBeInTheDocument();
});
