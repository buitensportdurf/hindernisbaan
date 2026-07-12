import { describe, expect, it } from 'vitest';
import { pascalToKebab, kebabToPascal, ALL_ICON_NAMES, getIconComponent } from './icons';

describe('pascalToKebab', () => {
  it('converts simple PascalCase names', () => {
    expect(pascalToKebab('Users')).toBe('users');
    expect(pascalToKebab('ArrowLeft')).toBe('arrow-left');
  });

  it('handles names with leading capital runs correctly', () => {
    expect(pascalToKebab('AArrowDown')).toBe('a-arrow-down');
    expect(pascalToKebab('ALargeSmall')).toBe('a-large-small');
  });
});

describe('kebabToPascal', () => {
  it('is the inverse of pascalToKebab for known icons', () => {
    expect(kebabToPascal('arrow-left')).toBe('ArrowLeft');
    expect(kebabToPascal('users')).toBe('Users');
    expect(kebabToPascal('a-arrow-down')).toBe('AArrowDown');
  });
});

describe('ALL_ICON_NAMES', () => {
  it('is a large, sorted, deduplicated list of kebab-case names', () => {
    expect(ALL_ICON_NAMES.length).toBeGreaterThan(1000);
    expect(ALL_ICON_NAMES).toContain('users');
    expect(ALL_ICON_NAMES).toContain('arrow-left');
    expect(new Set(ALL_ICON_NAMES).size).toBe(ALL_ICON_NAMES.length);
    expect([...ALL_ICON_NAMES].sort()).toEqual(ALL_ICON_NAMES);
  });
});

describe('getIconComponent', () => {
  it('resolves a real component for a known kebab name', () => {
    expect(getIconComponent('users')).toBeTruthy();
  });

  it('returns undefined for an unknown name', () => {
    expect(getIconComponent('not-a-real-icon-xyz')).toBeUndefined();
  });
});
