import { describe, expect, it } from 'vitest';
import { generateId } from './ids';

describe('generateId', () => {
  it('returns a string matching the schema UUID pattern', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns a different id on each call', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
