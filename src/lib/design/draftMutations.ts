import type { HindernisFeature, Member } from '$lib/data/types';

export function addFeature(
  features: HindernisFeature[],
  feature: HindernisFeature
): HindernisFeature[] {
  return [...features, feature];
}

export function updateFeature(
  features: HindernisFeature[],
  id: string,
  patch: Record<string, unknown>
): HindernisFeature[] {
  return features.map((f) =>
    f.id === id ? ({ ...f, properties: { ...f.properties, ...patch } } as HindernisFeature) : f
  );
}

export function setKind(
  features: HindernisFeature[],
  id: string,
  kind: 'obstacle' | 'combi' | 'landmark'
): HindernisFeature[] {
  return features.map((f) => {
    if (f.id !== id) return f;
    const base: { name: string; notes?: string } = { name: f.properties.name };
    if (f.properties.notes !== undefined) base.notes = f.properties.notes;
    if (kind === 'combi') {
      const members = f.properties.kind === 'combi' ? f.properties.members : [];
      return { ...f, properties: { ...base, kind, members } } as HindernisFeature;
    }
    if (kind === 'landmark') {
      const icon = f.properties.kind === 'landmark' ? f.properties.icon : '';
      return { ...f, properties: { ...base, kind, icon } } as HindernisFeature;
    }
    return { ...f, properties: { ...base, kind } } as HindernisFeature;
  });
}

export function removeFeature(features: HindernisFeature[], id: string): HindernisFeature[] {
  return features.filter((f) => f.id !== id);
}

export function addMember(features: HindernisFeature[], comboId: string): HindernisFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    return {
      ...f,
      properties: { ...f.properties, members: [...f.properties.members, { name: '' }] }
    } as HindernisFeature;
  });
}

export function updateMember(
  features: HindernisFeature[],
  comboId: string,
  index: number,
  patch: Partial<Member>
): HindernisFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    const members = f.properties.members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    return { ...f, properties: { ...f.properties, members } } as HindernisFeature;
  });
}

export function removeMember(
  features: HindernisFeature[],
  comboId: string,
  index: number
): HindernisFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    return {
      ...f,
      properties: { ...f.properties, members: f.properties.members.filter((_, i) => i !== index) }
    } as HindernisFeature;
  });
}
