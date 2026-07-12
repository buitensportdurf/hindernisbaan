import Ajv from 'ajv';
import schema from './obstacles.schema.json';
import type { FeatureCollection } from './types';

const ajv = new Ajv();
const validate = ajv.compile(schema);

export class LoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LoadError';
  }
}

export type ValidationResult = { valid: true } | { valid: false; errors: string };

export function validateCollection(data: unknown): ValidationResult {
  if (validate(data)) return { valid: true };
  return { valid: false, errors: ajv.errorsText(validate.errors) };
}

function assertValid(data: unknown): asserts data is FeatureCollection {
  const result = validateCollection(data);
  if (!result.valid) {
    throw new LoadError(`Invalid map data: ${result.errors}`);
  }
}

export const OBSTACLES_URL = '/data/obstacles.geojson';

export async function fetchFeatures(
  url = OBSTACLES_URL
): Promise<FeatureCollection> {
  let data: unknown;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    throw new LoadError(
      err instanceof Error ? err.message : 'Failed to fetch map data',
      err
    );
  }
  assertValid(data);
  return data;
}

export async function parseFeatures(text: string): Promise<FeatureCollection> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new LoadError('Invalid JSON in file', err);
  }
  assertValid(data);
  return data;
}
