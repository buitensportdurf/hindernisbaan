import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ResultReveal from './ResultReveal.svelte';
import { REVEAL_MS } from './reveal';
import type { RunRecord } from './runs';
import { createSoundboard } from './sound';

afterEach(() => cleanup());

const run = (correct: number, total = 20): RunRecord => ({
  v: 1,
  id: 'r1',
  startedAt: '2026-09-30T10:00:00.000Z',
  durationMs: 1,
  seed: 1,
  dataVersion: null,
  correct,
  total,
  answers: []
});

describe('ResultReveal', () => {
  it('shows the celebration dialog after a run', () => {
    render(ResultReveal, {
      locale: 'en',
      run: run(16),
      runs: [run(16)],
      mistakes: 4,
      sound: createSoundboard(() => false),
      reducedMotion: true,
      onMap: vi.fn(),
      onPractice: vi.fn(),
      onReport: vi.fn(),
      onClose: vi.fn()
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('16 of 20 right')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Herd leader/ })).toBeInTheDocument();
  });

  it('names the rank only after score and climb', () => {
    expect(REVEAL_MS.score).toBeLessThan(REVEAL_MS.ridge);
    expect(REVEAL_MS.ridge).toBeLessThan(REVEAL_MS.title);
    expect(REVEAL_MS.title).toBeLessThan(REVEAL_MS.caption);
  });
});
