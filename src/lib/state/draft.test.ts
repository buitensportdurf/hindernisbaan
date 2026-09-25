import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDraftState } from './draft.svelte';
import { createAppState } from './app.svelte';
import { parseFeatures } from '$lib/data/loader';
import { diffFeatures } from '$lib/design/draftDiff';
import type { FeatureCollection, MapFeature } from '$lib/data/types';

const DRAFT_KEY = 'durf:draft';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../data/fixtures/obstacles-2026-09-25.geojson');
const publishedPath = join(here, '../../../static/data/obstacles.geojson');

const publishedFeature: MapFeature = {
  type: 'Feature',
  id: '11111111-1111-4111-8111-111111111111',
  geometry: { type: 'Point', coordinates: [4.36, 52.02] },
  properties: { name: 'Published', kind: 'obstacle' }
};

const published: FeatureCollection = {
  type: 'FeatureCollection',
  club: 'Buitensport Durf',
  version: '2026-07-15',
  features: [publishedFeature]
};

function emptyishDraft(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    club: 'Local',
    version: '2026-09-25',
    features: []
  };
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDraftState.discard', () => {
  it('restores the published course and clears the stored draft', () => {
    const draft = createDraftState();
    draft.loadOrInit(published);
    draft.addFeature({
      type: 'Feature',
      id: '22222222-2222-4222-8222-222222222222',
      geometry: { type: 'Point', coordinates: [4.37, 52.03] },
      properties: { name: 'Local only', kind: 'obstacle' }
    });
    expect(draft.features).toHaveLength(2);
    expect(draft.hasStoredDraft).toBe(true);

    draft.discard(published);

    expect(draft.features).toEqual(published.features);
    expect(draft.club).toBe(published.club);
    expect(draft.version).toBe(published.version);
    expect(draft.isValid).toBe(true);
    expect(draft.hasStoredDraft).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('replaces an emptied draft with the published features, not an empty list', () => {
    const draft = createDraftState();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(emptyishDraft()));
    draft.loadOrInit(published);
    expect(draft.features).toHaveLength(0);

    draft.discard(published);

    expect(draft.features).toHaveLength(1);
    expect(draft.features[0].properties.name).toBe('Published');
    expect(draft.hasStoredDraft).toBe(false);
  });

  it('copies features so later draft edits do not mutate the published collection', () => {
    const draft = createDraftState();
    draft.loadOrInit(published);
    draft.discard(published);

    draft.updateFeature(publishedFeature.id, { name: 'Edited in draft' });

    expect(published.features[0].properties.name).toBe('Published');
    expect(draft.features[0].properties.name).toBe('Edited in draft');
  });

  it('restores a published course held in app state and leaves draft mode', () => {
    const app = createAppState();
    app.setData(published);
    const draft = createDraftState();
    draft.loadOrInit(published);
    draft.addFeature({
      type: 'Feature',
      id: '44444444-4444-4444-8444-444444444444',
      geometry: { type: 'Point', coordinates: [4.39, 52.05] },
      properties: { name: 'Extra', kind: 'obstacle' }
    });
    expect(draft.hasStoredDraft).toBe(true);

    draft.discard({
      type: 'FeatureCollection',
      club: app.dataClub!,
      version: app.dataVersion!,
      features: app.features
    });

    expect(draft.hasStoredDraft).toBe(false);
    expect(draft.version).toBe(published.version);
    expect(draft.features.map((f) => f.properties.name)).toEqual(['Published']);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('marks an invalid edit as a local draft so discard stays available', () => {
    const draft = createDraftState();
    draft.loadOrInit(published);
    expect(draft.hasStoredDraft).toBe(false);

    draft.addFeature({
      type: 'Feature',
      id: '33333333-3333-4333-8333-333333333333',
      geometry: { type: 'Point', coordinates: [4.38, 52.04] },
      properties: { name: '', kind: 'obstacle' }
    });

    expect(draft.isValid).toBe(false);
    expect(draft.hasStoredDraft).toBe(true);
  });
});

describe('createDraftState.replaceWith', () => {
  it('loads the published 2026-09-25 course as a persisted draft', async () => {
    const official = JSON.parse(readFileSync(publishedPath, 'utf8')) as FeatureCollection;
    const fixtureText = readFileSync(fixturePath, 'utf8');
    const imported = await parseFeatures(fixtureText);

    const draft = createDraftState();
    draft.loadOrInit(official);
    expect(draft.features).toHaveLength(43);
    expect(draft.hasStoredDraft).toBe(false);

    draft.replaceWith(imported);

    expect(draft.features).toHaveLength(43);
    expect(draft.version).toBe('2026-09-25');
    expect(draft.club).toBe('Buitensport Durf');
    expect(draft.isValid).toBe(true);
    expect(draft.hasStoredDraft).toBe(true);
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(draft.features.find((f) => f.id === 'fc3fc235-e0db-4b2a-a141-7d7817905f39')?.properties.name).toBe(
      'Lianen'
    );
    expect(diffFeatures(official.features, draft.features)).toEqual([]);
  });

  it('does not clear localStorage the way discard does', async () => {
    const draft = createDraftState();
    draft.loadOrInit(published);
    const imported = await parseFeatures(readFileSync(fixturePath, 'utf8'));

    draft.replaceWith(imported);
    expect(draft.hasStoredDraft).toBe(true);
    expect(localStorage.getItem(DRAFT_KEY)).toContain('"version":"2026-09-25"');

    draft.discard(published);
    expect(draft.hasStoredDraft).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
