import { render, screen } from '@testing-library/react';
import App from './App';

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
