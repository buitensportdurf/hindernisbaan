import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MapDataStatus from './MapDataStatus.svelte';
import { createAppState } from '$lib/state/app.svelte';
import { createDraftState } from '$lib/state/draft.svelte';
import type { FeatureCollection } from '$lib/data/types';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../data/fixtures/obstacles-2026-09-28.geojson');
const publishedPath = join(here, '../../../static/data/obstacles.geojson');

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
  cleanup();
  vi.unstubAllGlobals();
});

describe('MapDataStatus discard', () => {
  it('closes the confirm dialog and leaves draft mode', async () => {
    const official = JSON.parse(readFileSync(publishedPath, 'utf8')) as FeatureCollection;
    const app = createAppState();
    app.setLocale('en');
    app.setData(official);

    const draft = createDraftState();
    draft.loadOrInit(official);
    draft.updateFeature(official.features[0].id, { name: 'Renamed locally' });
    expect(draft.hasStoredDraft).toBe(true);

    render(MapDataStatus, { app, draft, onImport: vi.fn() });

    expect(screen.getByRole('button', { name: 'Discard draft' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Discard draft' })).not.toBeInTheDocument();
    expect(draft.hasStoredDraft).toBe(false);
    expect(draft.version).toBe(official.version);
    expect(draft.features[0].properties.name).toBe(official.features[0].properties.name);
    expect(screen.getByRole('button', { name: new RegExp(`Buitensport Durf · v${official.version}`) })).toBeInTheDocument();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
  });
});

describe('MapDataStatus import', () => {
  it('loads the published course and reports no changes against itself', async () => {
    const official = JSON.parse(readFileSync(publishedPath, 'utf8')) as FeatureCollection;
    const fixtureText = readFileSync(fixturePath, 'utf8');

    const app = createAppState();
    app.setLocale('en');
    app.setData(official);

    const draft = createDraftState();
    draft.loadOrInit(official);
    expect(draft.features).toHaveLength(48);

    const epochBefore = app.dataEpoch;
    render(MapDataStatus, { app, draft, onImport: vi.fn() });

    await fireEvent.click(screen.getByRole('button', { name: /Buitensport Durf · v2026-09-28/ }));

    const dialog = screen.getByRole('dialog');
    const input = dialog.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    // The file picker also clicks the input. That click must not hit the backdrop and unmount it.
    await fireEvent.click(input as HTMLInputElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const file = new File([fixtureText], 'obstacles-2026-09-28.geojson', {
      type: 'application/geo+json'
    });
    // jsdom File has no .text(); MapDataDialog awaits file.text().
    Object.defineProperty(file, 'text', {
      value: async () => fixtureText
    });
    await fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(draft.features).toHaveLength(48);
    });
    expect(draft.version).toBe('2026-09-28');
    expect(draft.hasStoredDraft).toBe(true);
    expect(app.dataEpoch).toBe(epochBefore + 1);
    expect(draft.features.find((f) => f.id === '601ef2a1-3fa1-4c88-a7a5-db75deabde81')?.properties.name).toBe(
      'PVC klimbuis'
    );

    await fireEvent.click(screen.getByRole('button', { name: /Buitensport Durf · v2026-09-28/ }));

    expect(screen.getByText('Changes from the published course')).toBeInTheDocument();
    expect(screen.getByText('No changes from the published course')).toBeInTheDocument();
  });
});
