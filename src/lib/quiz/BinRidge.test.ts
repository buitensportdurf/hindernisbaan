import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BinRidge from './BinRidge.svelte';
import { binName } from './bins';

afterEach(() => cleanup());

describe('BinRidge', () => {
  it('keeps rank names in Dutch', () => {
    expect(binName('en', 2)).toBe('Geitje');
    expect(binName('nl', 4)).toBe('Gids van de kudde');
  });

  it('labels every band under the ridge', () => {
    render(BinRidge, {
      locale: 'en',
      correct: 16,
      total: 20,
      climb: true,
      showCaption: true,
      reducedMotion: true
    });

    for (const name of ['Grasshopper', 'Marmot', 'Geitje', 'Steenbok', 'Gids van de kudde', 'Opperibex']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });
});
