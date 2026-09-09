import type { Calculation } from '@calc/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculatorApp } from './CalculatorApp';

/**
 * Covers the wiring between a completed calculation and the history panel.
 *
 * The panel is populated from the POST response rather than by re-reading the
 * list, so this asserts both halves: the new row appears, and no extra GET is
 * issued to discover something the client already holds.
 */
vi.mock('@/lib/api/client', () => ({
  evaluateExpression: vi.fn(),
  fetchHistory: vi.fn(),
  clearHistory: vi.fn(),
  deleteCalculation: vi.fn(),
}));

const client = await import('@/lib/api/client');
const evaluateExpression = vi.mocked(client.evaluateExpression);
const fetchHistory = vi.mocked(client.fetchHistory);

const calculation = (overrides: Partial<Calculation> = {}): Calculation => ({
  id: '11111111-1111-4111-8111-111111111111',
  expression: '7*6',
  displayExpression: '7 × 6',
  result: '42',
  displayResult: '42',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchHistory.mockResolvedValue({ items: [], nextCursor: null });
  evaluateExpression.mockResolvedValue(calculation());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('recording a calculation', () => {
  it('sends the expression to the API and shows the result', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: 'Multiply' }));
    await user.click(screen.getByRole('button', { name: '6' }));
    await user.click(screen.getByRole('button', { name: 'Equals' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('42'));
    expect(evaluateExpression).toHaveBeenCalledWith(
      { expression: '7*6', displayExpression: '7 × 6' },
      expect.anything(),
    );
  });

  it('adds the new entry to an open history panel without refetching it', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.click(screen.getByRole('button', { name: /show history/i }));
    await waitFor(() => expect(fetchHistory).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: 'Multiply' }));
    await user.click(screen.getByRole('button', { name: '6' }));
    await user.click(screen.getByRole('button', { name: 'Equals' }));

    // The row appears from the POST response...
    const panel = screen.getByRole('complementary', { name: 'Calculation history' });
    await waitFor(() => expect(panel.textContent).toContain('42'));
    expect(panel.textContent).toContain('7 × 6');
    // ...and the list was not re-read to discover it.
    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });

  it('leaves the panel alone while it is closed', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: 'Equals' }));

    await waitFor(() => expect(evaluateExpression).toHaveBeenCalled());
    expect(fetchHistory).not.toHaveBeenCalled();
  });
});
