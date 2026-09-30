import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HistoryList from './HistoryList.svelte';
import type { RunRecord } from './runs';

afterEach(() => cleanup());

const run = (id: string, correct: number): RunRecord => ({
  v: 1,
  id,
  startedAt: '2026-09-30T10:00:00.000Z',
  durationMs: 1,
  seed: 1,
  dataVersion: null,
  correct,
  total: 20,
  answers: []
});

describe('HistoryList', () => {
  it('opens the scale from the rank chip without opening the report', async () => {
    const onOpen = vi.fn();
    render(HistoryList, { locale: 'en', runs: [run('r1', 16)], onOpen });

    await fireEvent.click(screen.getByRole('button', { name: /Gids van de kudde — show the scale/ }));
    expect(onOpen).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Grasshopper')).toBeInTheDocument();
      expect(screen.getByText('Geitje')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('80%'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
