import { validateCollection } from '$lib/data/loader';
import { readKey, writeKey } from '$lib/storage/local';
import * as mutations from '$lib/design/draftMutations';
import type {
  FeatureCollection,
  HindernisFeature,
  Member,
  ObstacleFeature,
  CombiFeature,
  LandmarkFeature
} from '$lib/data/types';

const DRAFT_KEY = 'durf:draft';

export function createDraftState() {
  let features = $state<HindernisFeature[]>([]);
  let club = $state('');
  let version = $state('');
  let isValid = $state(true);
  let validationErrors = $state<string | null>(null);
  let hasStoredDraft = $state(false);

  function collection(): FeatureCollection {
    return { type: 'FeatureCollection', club, version, features };
  }

  function revalidateAndPersist() {
    const result = validateCollection(collection());
    isValid = result.valid;
    validationErrors = result.valid ? null : result.errors;
    if (result.valid) {
      writeKey(DRAFT_KEY, JSON.stringify(collection()));
      hasStoredDraft = true;
    }
  }

  function apply(next: HindernisFeature[]) {
    features = next;
    revalidateAndPersist();
  }

  return {
    get features() { return features; },
    get club() { return club; },
    get version() { return version; },
    get isValid() { return isValid; },
    get validationErrors() { return validationErrors; },
    get hasStoredDraft() { return hasStoredDraft; },
    get obstacles(): ObstacleFeature[] {
      return features.filter((f): f is ObstacleFeature => f.properties.kind === 'obstacle');
    },
    get combis(): CombiFeature[] {
      return features.filter((f): f is CombiFeature => f.properties.kind === 'combi');
    },
    get landmarks(): LandmarkFeature[] {
      return features.filter((f): f is LandmarkFeature => f.properties.kind === 'landmark');
    },

    loadOrInit(live: FeatureCollection) {
      const stored = readKey(DRAFT_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as FeatureCollection;
          const result = validateCollection(parsed);
          club = parsed.club;
          version = parsed.version;
          features = parsed.features;
          isValid = result.valid;
          validationErrors = result.valid ? null : result.errors;
          hasStoredDraft = true;
          return;
        } catch {
          // fall through to live data if the stored draft is corrupt JSON
        }
      }
      club = live.club;
      version = live.version;
      features = live.features;
      isValid = true;
      validationErrors = null;
      hasStoredDraft = false;
    },

    addFeature(feature: HindernisFeature) { apply(mutations.addFeature(features, feature)); },
    updateFeature(id: string, patch: Record<string, unknown>) {
      apply(mutations.updateFeature(features, id, patch));
    },
    setKind(id: string, kind: 'obstacle' | 'combi' | 'landmark') {
      apply(mutations.setKind(features, id, kind));
    },
    removeFeature(id: string) { apply(mutations.removeFeature(features, id)); },
    updateGeometry(id: string, geometry: HindernisFeature['geometry']) {
      apply(features.map((f) => (f.id === id ? ({ ...f, geometry } as HindernisFeature) : f)));
    },
    addMember(comboId: string) { apply(mutations.addMember(features, comboId)); },
    updateMember(comboId: string, index: number, patch: Partial<Member>) {
      apply(mutations.updateMember(features, comboId, index, patch));
    },
    removeMember(comboId: string, index: number) {
      apply(mutations.removeMember(features, comboId, index));
    },

    discard(live: FeatureCollection) {
      club = live.club;
      version = live.version;
      features = live.features;
      isValid = true;
      validationErrors = null;
      writeKey(DRAFT_KEY, JSON.stringify(live));
      hasStoredDraft = false;
    },

    exportCollection(): FeatureCollection {
      const today = new Date().toISOString().slice(0, 10);
      return { type: 'FeatureCollection', club, version: today, features };
    }
  };
}

export type DraftState = ReturnType<typeof createDraftState>;
