import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { tick } from 'svelte';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Move focus to the element with the given id once pending DOM updates have
 * flushed. Uses `preventScroll` so focusing inside animated overlays (drawer,
 * menu panel) doesn't scroll or jump the page mid-animation.
 */
export async function focusById(id: string): Promise<void> {
  await tick();
  document.getElementById(id)?.focus({ preventScroll: true });
}
