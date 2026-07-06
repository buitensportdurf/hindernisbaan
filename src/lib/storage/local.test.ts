import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLocalStorageAvailable, readKey, writeKey } from './local';

afterEach(() => vi.unstubAllGlobals());

describe('isLocalStorageAvailable', () => {
  it('true when localStorage works', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });
  it('false when setItem throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('denied'); },
      removeItem: () => {},
      getItem: () => null
    });
    expect(isLocalStorageAvailable()).toBe(false);
  });
});

describe('readKey/writeKey', () => {
  it('round-trips a value', () => {
    writeKey('durf:test', 'hi');
    expect(readKey('durf:test')).toBe('hi');
  });
  it('readKey returns null on throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => {},
      removeItem: () => {}
    });
    expect(readKey('durf:test')).toBeNull();
  });
});
