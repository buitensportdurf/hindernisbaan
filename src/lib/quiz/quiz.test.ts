import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FeatureCollection, MapFeature } from '$lib/data/types';
import {
  BINS,
  MAX_SAME_NAME,
  RUN_LENGTH,
  TIER_TIME_MS,
  binIndex,
  buildRun,
  clampRunLength,
  nextRunLength,
  runLengthOptions,
  runMinutes,
  centroid,
  isPass,
  isQuizzable,
  mulberry32,
  percentOf,
  toNextBin
} from './quiz';

const here = dirname(fileURLToPath(import.meta.url));
const course = JSON.parse(
  readFileSync(join(here, '../data/fixtures/obstacles-2026-09-28.geojson'), 'utf8')
) as FeatureCollection;
const byId = new Map(course.features.map((f) => [f.id, f]));
const nameOf = (id: string) => byId.get(id)!.properties.name;

describe('mulberry32', () => {
  it('repeats for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('centroid', () => {
  it('ignores the closing vertex of a polygon ring', () => {
    const f: MapFeature = {
      type: 'Feature',
      id: 'p',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] },
      properties: { name: 'Vak', kind: 'obstacle' }
    };
    expect(centroid(f)).toEqual([1, 1]);
  });
});

describe('buildRun', () => {
  const seeds = [1, 7, 99, 12345, 2 ** 31];

  it('is deterministic per seed', () => {
    expect(buildRun(course.features, 7)).toEqual(buildRun(course.features, 7));
    expect(buildRun(course.features, 7)).not.toEqual(buildRun(course.features, 8));
  });

  it('asks 20 different features over four tiers of five', () => {
    for (const seed of seeds) {
      const run = buildRun(course.features, seed);
      expect(run).toHaveLength(RUN_LENGTH);
      expect(new Set(run.map((q) => q.targetId)).size).toBe(RUN_LENGTH);
      expect(run.map((q) => q.tier)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
      const perName = new Map<string, number>();
      for (const q of run) perName.set(nameOf(q.targetId), (perName.get(nameOf(q.targetId)) ?? 0) + 1);
      expect(Math.max(...perName.values())).toBeLessThanOrEqual(MAX_SAME_NAME);
      expect(run.map((q) => q.timeLimitMs)).toEqual(run.map((q) => TIER_TIME_MS[q.tier]));
      expect(run.every((q) => byId.get(q.targetId)!.properties.kind !== 'landmark')).toBe(true);
    }
  });

  it('opens with Name it', () => {
    for (const seed of seeds) expect(buildRun(course.features, seed)[0].type).toBe('name');
  });

  it('only asks Find it for names that exist once on the course', () => {
    const counts = new Map<string, number>();
    for (const f of course.features.filter(isQuizzable)) {
      counts.set(f.properties.name, (counts.get(f.properties.name) ?? 0) + 1);
    }
    for (const seed of seeds) {
      for (const q of buildRun(course.features, seed).filter((q) => q.type === 'find')) {
        expect(counts.get(nameOf(q.targetId))).toBe(1);
        expect(q.options).toEqual([]);
      }
    }
  });

  it('gives Name it four distinct options including the answer', () => {
    for (const seed of seeds) {
      for (const q of buildRun(course.features, seed).filter((q) => q.type === 'name')) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(nameOf(q.targetId));
      }
    }
  });

  it('asks whose-combi for members about as often as Name it and Find it', () => {
    let name = 0;
    let find = 0;
    let member = 0;
    for (let seed = 0; seed < 80; seed++) {
      for (const q of buildRun(course.features, seed)) {
        if (q.memberName) member += 1;
        else if (q.type === 'find') find += 1;
        else name += 1;
      }
    }
    for (const n of [name, find, member]) {
      expect(n).toBeGreaterThan(350);
      expect(n).toBeLessThan(750);
    }
  });

  it('ties a member prompt to the combi that lists it', () => {
    const membersOf = new Map<string, string[]>();
    for (const f of course.features) {
      if (f.properties.kind !== 'combi') continue;
      membersOf.set(
        f.id,
        f.properties.members.map((m) => m.name.trim()).filter(Boolean)
      );
    }
    for (const seed of seeds) {
      for (const q of buildRun(course.features, seed).filter((q) => q.memberName)) {
        expect(byId.get(q.targetId)!.properties.kind).toBe('combi');
        expect(membersOf.get(q.targetId)).toContain(q.memberName);
        if (q.type === 'name') {
          expect(q.options).toContain(nameOf(q.targetId));
          expect(q.options.every((n) => [...byId.values()].some((f) => f.properties.kind === 'combi' && f.properties.name === n))).toBe(
            true
          );
        }
      }
    }
  });

  it('keeps the target in frame, and frames the whole course without landmarks in the finale', () => {
    for (const seed of seeds) {
      for (const q of buildRun(course.features, seed)) {
        if (q.tier === 3) {
          expect(q.frameIds).toEqual([]);
          expect(q.hideLandmarks).toBe(true);
        } else {
          expect(q.frameIds).toContain(q.targetId);
          expect(q.hideLandmarks).toBe(false);
        }
      }
    }
  });

  it('leans on combis early and point obstacles late', () => {
    let early = 0;
    let late = 0;
    for (let seed = 0; seed < 200; seed++) {
      const run = buildRun(course.features, seed);
      early += run.filter((q) => q.tier === 0 && byId.get(q.targetId)!.properties.kind === 'combi').length;
      late += run.filter((q) => q.tier === 2 && byId.get(q.targetId)!.properties.kind === 'combi').length;
    }
    expect(early).toBeGreaterThan(late * 2);
  });

  it('honours a shorter length and still walks the four-tier weights', () => {
    const run = buildRun(course.features, 7, 10);
    expect(run).toHaveLength(10);
    expect(run.map((q) => q.tier)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(buildRun(course.features, 7, 15)).toHaveLength(15);
  });

  it('shifts Find it off the target so the viewport centre is not the answer', () => {
    for (const seed of seeds) {
      for (const q of buildRun(course.features, seed).filter((q) => q.type === 'find' && q.tier < 3)) {
        expect(q.frameShift).toBeDefined();
        const target = byId.get(q.targetId)!;
        const c = centroid(target);
        expect(Math.hypot(q.frameShift![0] - c[0], q.frameShift![1] - c[1])).toBeGreaterThan(0);
        expect(q.frameIds.length).toBeGreaterThan(3);
        const bounds = L.latLngBounds([]);
        for (const id of q.frameIds) {
          const [lng, lat] = centroid(byId.get(id)!);
          bounds.extend([lat, lng]);
        }
        bounds.extend([q.frameShift![1], q.frameShift![0]]);
        expect(bounds.getCenter().distanceTo(L.latLng(c[1], c[0]))).toBeGreaterThan(20);
      }
    }
  });

  it('shortens the run on a small course', () => {
    const small = course.features.filter(isQuizzable).slice(0, 6);
    const run = buildRun(small, 3);
    expect(run).toHaveLength(6);
    expect(run.filter((q) => q.type === 'name' && !q.memberName).every((q) => q.options.length === 4)).toBe(true);
    expect(
      run.filter((q) => q.type === 'name' && q.memberName).every((q) => q.options.includes(nameOf(q.targetId)))
    ).toBe(true);
  });
});

describe('run length', () => {
  it('steps from 10 to 40 and falls back to 20', () => {
    expect(clampRunLength(10)).toBe(10);
    expect(clampRunLength(23)).toBe(25);
    expect(clampRunLength(40)).toBe(40);
    expect(clampRunLength(12)).toBe(10);
    expect(clampRunLength(99)).toBe(40);
    expect(clampRunLength(Number.NaN)).toBe(20);
    expect(nextRunLength(20)).toBe(25);
    expect(nextRunLength(40)).toBe(10);
    expect(nextRunLength(20, 22)).toBe(10);
    expect(runLengthOptions()).toEqual([10, 15, 20, 25, 30, 35, 40]);
    expect(runLengthOptions(22)).toEqual([10, 15, 20]);
    expect(runMinutes(10)).toBe(2);
    expect(runMinutes(20)).toBe(4);
    expect(runMinutes(40)).toBe(8);
  });
});

describe('bins', () => {
  it('maps the six ranges', () => {
    expect(BINS.map((b) => b.key)).toEqual(['grasshopper', 'marmot', 'geitje', 'steenbok', 'gids', 'opperibex']);
    expect([0, 15, 20, 55, 60, 75, 80, 90, 95, 100].map(binIndex)).toEqual([0, 0, 1, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('passes from 60%', () => {
    expect(isPass(percentOf(11, 20))).toBe(false);
    expect(isPass(percentOf(12, 20))).toBe(true);
  });

  it('never rounds up across a threshold', () => {
    expect(percentOf(7, 12)).toBe(58);
  });

  it('counts answers still needed for the next bin', () => {
    expect(toNextBin(15, 20)).toEqual({ bin: 4, needed: 1 });
    expect(toNextBin(9, 20)).toEqual({ bin: 3, needed: 3 });
    expect(toNextBin(19, 20)).toBeNull();
  });
});
