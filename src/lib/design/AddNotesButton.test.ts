import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AddNotesButton from './AddNotesButton.svelte';

afterEach(() => cleanup());

describe('AddNotesButton', () => {
  it('icon variant calls onclick when the note button is clicked', async () => {
    const onclick = vi.fn();
    render(AddNotesButton, { variant: 'icon', locale: 'en', onclick });

    await fireEvent.click(screen.getByRole('button', { name: 'Add notes' }));

    expect(onclick).toHaveBeenCalledOnce();
  });

  it('text variant shows a note icon and calls onclick', async () => {
    const onclick = vi.fn();
    render(AddNotesButton, { locale: 'en', onclick });

    const button = screen.getByRole('button', { name: 'Add notes' });
    expect(button.querySelector('svg')).not.toBeNull();
    await fireEvent.click(button);

    expect(onclick).toHaveBeenCalledOnce();
  });
});