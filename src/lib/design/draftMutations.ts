import type { MapFeature, Member } from '$lib/data/types';

export function addFeature(
  features: MapFeature[],
  feature: MapFeature
): MapFeature[] {
  return [...features, feature];
}

export function updateFeature(
  features: MapFeature[],
  id: string,
  patch: Record<string, unknown>
): MapFeature[] {
  return features.map((f) =>
    f.id === id ? ({ ...f, properties: { ...f.properties, ...patch } } as MapFeature) : f
  );
}

export function setKind(
  features: MapFeature[],
  id: string,
  kind: 'obstacle' | 'combi' | 'landmark'
): MapFeature[] {
  return features.map((f) => {
    if (f.id !== id) return f;
    const base: { name: string; notes?: string } = { name: f.properties.name };
    if (f.properties.notes !== undefined) base.notes = f.properties.notes;
    if (kind === 'combi') {
      const members = f.properties.kind === 'combi' ? f.properties.members : [];
      return { ...f, properties: { ...base, kind, members } } as MapFeature;
    }
    if (kind === 'landmark') {
      const icon = f.properties.kind === 'landmark' ? f.properties.icon : '';
      return { ...f, properties: { ...base, kind, icon } } as MapFeature;
    }
    return { ...f, properties: { ...base, kind } } as MapFeature;
  });
}

export function removeFeature(features: MapFeature[], id: string): MapFeature[] {
  return features.filter((f) => f.id !== id);
}

export function addMember(features: MapFeature[], comboId: string): MapFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    return {
      ...f,
      properties: { ...f.properties, members: [...f.properties.members, { name: '' }] }
    } as MapFeature;
  });
}

export function updateMember(
  features: MapFeature[],
  comboId: string,
  index: number,
  patch: Partial<Member>
): MapFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    const members = f.properties.members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    return { ...f, properties: { ...f.properties, members } } as MapFeature;
  });
}

export function removeMember(
  features: MapFeature[],
  comboId: string,
  index: number
): MapFeature[] {
  return features.map((f) => {
    if (f.id !== comboId || f.properties.kind !== 'combi') return f;
    return {
      ...f,
      properties: { ...f.properties, members: f.properties.members.filter((_, i) => i !== index) }
    } as MapFeature;
  });
}
