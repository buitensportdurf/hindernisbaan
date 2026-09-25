import { describe, expect, it } from 'vitest';
import { toolbarMode } from './toolbarMode';

describe('toolbarMode', () => {
  it('shows create tools when idle', () => {
    expect(toolbarMode(null, null)).toBe('create');
  });

  it('shows selected actions when a feature is selected', () => {
    expect(toolbarMode(null, 'feat-1')).toBe('selected');
  });

  it('keeps create tools while a draw tool is active', () => {
    expect(toolbarMode('point', null)).toBe('create');
    expect(toolbarMode('polygon', 'feat-1')).toBe('create');
  });
});
