import type { MapFeature } from '$lib/data/types';

export type FaultCode = 'nameMissing' | 'membersMissing';

/**
 * Per-feature faults for obstacles and combis. Mirrors the schema rules a
 * designer can actually break from the editor (see featureFaults.test.ts).
 */
export function featureFaults(features: MapFeature[]): Map<string, FaultCode[]> {
  const faults = new Map<string, FaultCode[]>();
  for (const f of features) {
    const { properties } = f;
    if (properties.kind === 'landmark') continue;
    const codes: FaultCode[] = [];
    if (properties.name.length === 0) codes.push('nameMissing');
    if (properties.kind === 'combi' && properties.members.length === 0) codes.push('membersMissing');
    if (codes.length > 0) faults.set(f.id, codes);
  }
  return faults;
}
