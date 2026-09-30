import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProgressChart from './ProgressChart.svelte';

afterEach(() => cleanup());

describe('ProgressChart', () => {
  it('labels the pass mark in the UI language', () => {
    const { unmount } = render(ProgressChart, { locale: 'en', percents: [20, 40, 55] });
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/60% · good enough/);
    unmount();
    render(ProgressChart, { locale: 'nl', percents: [20, 40, 55] });
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/60% · goed genoeg/);
  });
});
