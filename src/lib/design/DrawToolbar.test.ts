import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DrawToolbar from './DrawToolbar.svelte';

afterEach(() => cleanup());

describe('DrawToolbar', () => {
  it('shows create tools when nothing is selected', () => {
    render(DrawToolbar, { locale: 'en', tool: null, selectedId: null });

    expect(screen.getByRole('radio', { name: 'Obstacle' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByText('Double-click for details')).toBeNull();
  });

  it('shows selected actions and hint when a feature is selected', async () => {
    const onDeselect = vi.fn();
    const onDeleteSelected = vi.fn();
    render(DrawToolbar, {
      locale: 'en',
      tool: null,
      selectedId: 'feat-1',
      onDeselect,
      onDeleteSelected
    });

    expect(screen.queryByRole('radio', { name: 'Obstacle' })).toBeNull();
    expect(screen.getByText('Double-click for details')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDeselect).toHaveBeenCalledOnce();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteSelected).toHaveBeenCalledOnce();
  });

  it('keeps create tools while a draw tool is active even with a selectedId', () => {
    render(DrawToolbar, { locale: 'en', tool: 'point', selectedId: 'feat-1' });

    expect(screen.getByRole('radio', { name: 'Obstacle' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });
});
