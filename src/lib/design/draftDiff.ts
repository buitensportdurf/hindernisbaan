import type { MapFeature } from '$lib/data/types';

export type DraftChangeField = 'name' | 'notes' | 'geometry' | 'kind' | 'icon' | 'members';

export type DraftChange =
  | { type: 'added'; id: string; name: string }
  | { type: 'removed'; id: string; name: string }
  | { type: 'updated'; id: string; name: string; fields: DraftChangeField[] };

function displayName(feature: MapFeature): string {
  return feature.properties.name.trim();
}

function changedFields(official: MapFeature, draft: MapFeature): DraftChangeField[] {
  const fields: DraftChangeField[] = [];
  if (official.properties.name !== draft.properties.name) fields.push('name');
  if ((official.properties.notes ?? '') !== (draft.properties.notes ?? '')) fields.push('notes');
  if (JSON.stringify(official.geometry) !== JSON.stringify(draft.geometry)) fields.push('geometry');
  if (official.properties.kind !== draft.properties.kind) fields.push('kind');
  const officialIcon = official.properties.kind === 'landmark' ? official.properties.icon : undefined;
  const draftIcon = draft.properties.kind === 'landmark' ? draft.properties.icon : undefined;
  if (officialIcon !== draftIcon) fields.push('icon');
  const officialMembers = official.properties.kind === 'combi' ? official.properties.members : undefined;
  const draftMembers = draft.properties.kind === 'combi' ? draft.properties.members : undefined;
  if (JSON.stringify(officialMembers ?? null) !== JSON.stringify(draftMembers ?? null)) {
    fields.push('members');
  }
  return fields;
}

/** Feature-level differences between the published course and the local draft. */
export function diffFeatures(official: MapFeature[], draft: MapFeature[]): DraftChange[] {
  const officialById = new Map(official.map((feature) => [feature.id, feature]));
  const draftIds = new Set(draft.map((feature) => feature.id));
  const changes: DraftChange[] = [];

  for (const feature of draft) {
    const previous = officialById.get(feature.id);
    if (!previous) {
      changes.push({ type: 'added', id: feature.id, name: displayName(feature) });
      continue;
    }
    const fields = changedFields(previous, feature);
    if (fields.length > 0) {
      changes.push({ type: 'updated', id: feature.id, name: displayName(feature), fields });
    }
  }

  for (const feature of official) {
    if (!draftIds.has(feature.id)) {
      changes.push({ type: 'removed', id: feature.id, name: displayName(feature) });
    }
  }

  return changes;
}
