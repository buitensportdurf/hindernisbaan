import { describe, it, expect } from 'vitest';
import { detectLocale, resolveInitialLocale, t } from './index';
import { dict, type TKey } from './dict';

describe('detectLocale', () => {
  it('maps nl* to nl', () => {
    expect(detectLocale('nl')).toBe('nl');
    expect(detectLocale('nl-NL')).toBe('nl');
  });
  it('maps anything else to en', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});

describe('resolveInitialLocale', () => {
  it('prefers a valid stored locale', () => {
    expect(resolveInitialLocale('en', 'nl-NL')).toBe('en');
    expect(resolveInitialLocale('nl', 'en-US')).toBe('nl');
  });
  it('falls back to detection when stored is missing or invalid', () => {
    expect(resolveInitialLocale(null, 'nl-NL')).toBe('nl');
    expect(resolveInitialLocale('fr', 'en-US')).toBe('en');
  });
});

describe('t', () => {
  it('returns the string for the locale', () => {
    expect(t('nl', 'menu.search')).toBe(dict.nl['menu.search']);
    expect(t('en', 'menu.search')).toBe(dict.en['menu.search']);
  });
  it('every nl key has an en counterpart', () => {
    for (const k of Object.keys(dict.nl) as TKey[]) {
      expect(dict.en[k], `missing en for ${k}`).toBeTypeOf('string');
    }
  });
});
