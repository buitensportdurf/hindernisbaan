import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BinRidge from './BinRidge.svelte';

afterEach(() => cleanup());

describe('BinRidge', () => {
  it('labels every band the climb has reached', () => {
    render(BinRidge, {
      locale: 'en',
      correct: 16,
      total: 20,
      climb: true,
      showCaption: true,
      reducedMotion: true
    });

    expect(screen.getByText('Grasshopper')).toBeInTheDocument();
    expect(screen.getByText('Marmot')).toBeInTheDocument();
    expect(screen.getByText('Kid goat')).toBeInTheDocument();
    expect(screen.getByText('Ibex')).toBeInTheDocument();
    expect(screen.getAllByText('Herd leader').length).toBeGreaterThan(0);
    expect(screen.queryByText('Top ibex')).not.toBeInTheDocument();
  });
});
