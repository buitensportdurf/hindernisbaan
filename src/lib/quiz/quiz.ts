import type { CombiFeature, MapFeature, ObstacleFeature } from '$lib/data/types';

export type QuestionType = 'name' | 'find';
export type Outcome = 'correct' | 'wrong' | 'timeout';
export type Quizzable = ObstacleFeature | CombiFeature;

export const RUN_LENGTH = 20;
export const RUN_LENGTH_MIN = 10;
export const RUN_LENGTH_MAX = 40;
export const RUN_LENGTH_STEP = 5;
export type RunLength = number;
export const TIER_COUNT = 4;
export const TIER_SIZE = RUN_LENGTH / TIER_COUNT;
export const TIER_TIME_MS = [20_000, 18_000, 16_000, 15_000] as const;
/** Clock on a question, in seconds — shown on the start sheet. */
export const QUESTION_CLOCK_S = {
  lo: TIER_TIME_MS[TIER_TIME_MS.length - 1] / 1000,
  hi: TIER_TIME_MS[0] / 1000
} as const;
/** Hard stop for a whole run; per-question clocks keep a normal run near six minutes. */
export const RUN_CAP_MS = 15 * 60_000;
export const OPTION_COUNT = 4;
export const PASS_PERCENT = 60;

export interface Question {
  tier: number;
  type: QuestionType;
  targetId: string;
  /** Name it: answer names in display order. Find it: empty. */
  options: string[];
  /** Features the camera frames. Empty frames the whole course. */
  frameIds: string[];
  /** Extra point in the Find it frame so the answer is not at the viewport centre. */
  frameShift?: [number, number];
  maxZoom: number;
  hideLandmarks: boolean;
  /** Null for untimed practice questions. */
  timeLimitMs: number | null;
}

export const BINS = [
  { key: 'grasshopper', min: 0 },
  { key: 'marmot', min: 20 },
  { key: 'geitje', min: 40 },
  { key: 'steenbok', min: 60 },
  { key: 'gids', min: 80 },
  { key: 'opperibex', min: 95 }
] as const;

export type BinKey = (typeof BINS)[number]['key'];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function clampRunLength(n: number): RunLength {
  if (!Number.isFinite(n)) return RUN_LENGTH;
  const stepped = Math.round(n / RUN_LENGTH_STEP) * RUN_LENGTH_STEP;
  return Math.min(RUN_LENGTH_MAX, Math.max(RUN_LENGTH_MIN, stepped));
}

/** Walks 10, 15, … up to the course cap, then back to 10. */
export function nextRunLength(current: number, available = RUN_LENGTH_MAX): RunLength {
  const options = runLengthOptions(available);
  const n = clampRunLength(current);
  const i = options.indexOf(n);
  return options[(i + 1) % options.length] ?? options[0] ?? RUN_LENGTH;
}

/** Lengths the start sheet can offer, given how many obstacles the course has. */
export function runLengthOptions(available = RUN_LENGTH_MAX): RunLength[] {
  const cap = Math.min(
    RUN_LENGTH_MAX,
    Math.max(RUN_LENGTH_MIN, Math.floor(available / RUN_LENGTH_STEP) * RUN_LENGTH_STEP)
  );
  const out: RunLength[] = [];
  for (let n = RUN_LENGTH_MIN; n <= cap; n += RUN_LENGTH_STEP) out.push(n);
  return out.length > 0 ? out : [RUN_LENGTH_MIN];
}

/** Typical sitting — looking and answering, not waiting out the clock. */
export function runMinutes(length: number): number {
  return Math.max(2, Math.round((length * 12) / 60));
}

export function isQuizzable(f: MapFeature): f is Quizzable {
  return f.properties.kind !== 'landmark' && f.properties.name.trim() !== '';
}

export function centroid(f: MapFeature): [number, number] {
  const g = f.geometry;
  let pts: [number, number][];
  if (g.type === 'Point') pts = [g.coordinates];
  else if (g.type === 'LineString') pts = g.coordinates;
  else {
    const ring = g.coordinates[0];
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    pts = ring.length > 1 && fx === lx && fy === ly ? ring.slice(0, -1) : ring;
  }
  let x = 0;
  let y = 0;
  for (const [px, py] of pts) {
    x += px;
    y += py;
  }
  return [x / pts.length, y / pts.length];
}

/** Planar distance in degrees of latitude — fine for ranking neighbours on one course. */
function distance(a: [number, number], b: [number, number]): number {
  const kx = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, a[1] - b[1]);
}

/** Combis are big and easy to spot, lines less so, single-point obstacles are hardest. */
function shapeClass(f: Quizzable): 0 | 1 | 2 {
  if (f.properties.kind === 'combi') return 0;
  return f.geometry.type === 'Point' ? 2 : 1;
}

/** Pick weight per tier for [combi, line/area, point]. */
const TIER_WEIGHTS: readonly (readonly [number, number, number])[] = [
  [1, 0.12, 0.04],
  [0.6, 0.8, 0.4],
  [0.3, 0.8, 1],
  [1, 1, 1]
];

/** Name it frames close early on; Find it frames a neighbourhood that grows per tier. */
const NAME_FRAME_NEIGHBOURS = [1, 3, 6];
const FIND_FRAME_NEIGHBOURS = [6, 9, 14];
/** A name shared by many features (the course has seven Apenhangs) would otherwise crowd a run. */
export const MAX_SAME_NAME = 2;

function weightedPick(pool: Quizzable[], tier: number, rand: () => number): Quizzable {
  const weights = pool.map((f) => TIER_WEIGHTS[tier][shapeClass(f)]);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Question types for one tier: mostly Name it, never opening a run with Find it. */
function tierTypes(tier: number, rand: () => number): QuestionType[] {
  const types = shuffle<QuestionType>(['name', 'name', 'name', 'find', 'find'], rand);
  if (tier === 0 && types[0] === 'find') {
    const i = types.indexOf('name');
    [types[0], types[i]] = [types[i], types[0]];
  }
  return types;
}

export function buildRun(features: MapFeature[], seed: number, length = RUN_LENGTH): Question[] {
  const rand = mulberry32(seed);
  const all = features.filter(isQuizzable);
  const centres = new Map(all.map((f) => [f.id, centroid(f)]));
  const nameCount = new Map<string, number>();
  for (const f of all) nameCount.set(f.properties.name, (nameCount.get(f.properties.name) ?? 0) + 1);
  // Find it needs a name that points at exactly one place on the course.
  const findable = (f: Quizzable) => nameCount.get(f.properties.name) === 1;

  const byDistance = (from: Quizzable, list: Quizzable[]) => {
    const c = centres.get(from.id)!;
    return list
      .filter((f) => f.id !== from.id)
      .map((f) => ({ f, d: distance(c, centres.get(f.id)!) }))
      .sort((a, b) => a.d - b.d)
      .map(({ f }) => f);
  };

  const total = Math.min(length, all.length);
  const pool = [...all];
  const questions: Question[] = [];
  const asked = new Map<string, number>();

  for (let tier = 0; questions.length < total && pool.length > 0; tier = Math.min(tier + 1, TIER_COUNT - 1)) {
    for (const wanted of tierTypes(tier, rand)) {
      if (questions.length >= total || pool.length === 0) break;
      const findPool = pool.filter(findable);
      const type: QuestionType = wanted === 'find' && findPool.length > 0 ? 'find' : 'name';
      const target = weightedPick(type === 'find' ? findPool : pool, tier, rand);
      pool.splice(pool.indexOf(target), 1);
      const name = target.properties.name;
      asked.set(name, (asked.get(name) ?? 0) + 1);
      if (asked.get(name)! >= MAX_SAME_NAME) {
        for (let i = pool.length - 1; i >= 0; i--) if (pool[i].properties.name === name) pool.splice(i, 1);
      }

      const near = byDistance(target, all);
      let frameIds: string[] = [];
      let frameShift: [number, number] | undefined;
      if (tier < TIER_COUNT - 1) {
        if (type === 'name') {
          frameIds = [target.id, ...near.slice(0, NAME_FRAME_NEIGHBOURS[tier]).map((f) => f.id)];
        } else {
          // Neighbourhood around a nearby (not closest) feature, then pull the
          // camera off the answer with a random extra point so the centre is not a clue.
          const skip = Math.min(2, Math.max(0, near.length - 4));
          const anchors = near.slice(skip, skip + 5);
          const anchor = anchors.length > 0 ? anchors[Math.floor(rand() * anchors.length)] : target;
          frameIds = [...new Set([anchor.id, ...byDistance(anchor, all).slice(0, FIND_FRAME_NEIGHBOURS[tier]).map((f) => f.id), target.id])];
          const c = centres.get(target.id)!;
          const reach = near[Math.min(4, Math.max(0, near.length - 1))];
          const span = reach ? distance(c, centres.get(reach.id)!) : 0.0004;
          const dist = (0.85 + rand() * 0.7) * Math.max(span, 0.0003);
          const ang = rand() * Math.PI * 2;
          const kx = Math.cos((c[1] * Math.PI) / 180);
          const desired: [number, number] = [
            c[0] + (Math.cos(ang) * dist) / Math.max(kx, 0.2),
            c[1] + Math.sin(ang) * dist
          ];
          let minLng = Infinity,
            maxLng = -Infinity,
            minLat = Infinity,
            maxLat = -Infinity;
          for (const id of frameIds) {
            const p = centres.get(id)!;
            minLng = Math.min(minLng, p[0]);
            maxLng = Math.max(maxLng, p[0]);
            minLat = Math.min(minLat, p[1]);
            maxLat = Math.max(maxLat, p[1]);
          }
          frameShift = [
            desired[0] >= (minLng + maxLng) / 2 ? 2 * desired[0] - minLng : 2 * desired[0] - maxLng,
            desired[1] >= (minLat + maxLat) / 2 ? 2 * desired[1] - minLat : 2 * desired[1] - maxLat
          ];
        }
      }

      questions.push({
        tier,
        type,
        targetId: target.id,
        options: type === 'name' ? nameOptions(target, all, near, tier, rand) : [],
        frameIds,
        frameShift,
        maxZoom: type === 'find' ? 17.5 : type === 'name' && tier === 0 ? 18.5 : 18,
        hideLandmarks: tier === TIER_COUNT - 1,
        timeLimitMs: TIER_TIME_MS[tier]
      });
    }
  }
  return questions;
}

function nameWords(name: string): Set<string> {
  return new Set(name.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
}

/** True when two names share a word like "apenhang" or "combi", which makes them easy to confuse. */
function looksAlike(a: string, b: string): boolean {
  const wa = nameWords(a);
  for (const w of nameWords(b)) if (wa.has(w)) return true;
  return false;
}

/**
 * Correct name plus distractors with distinct names. Early tiers draw from far away
 * and avoid look-alike names; later tiers use the same kind, the nearest neighbours
 * and look-alike names first.
 */
function nameOptions(
  target: Quizzable,
  all: Quizzable[],
  nearToFar: Quizzable[],
  tier: number,
  rand: () => number
): string[] {
  const correct = target.properties.name;
  const others = nearToFar.filter((f) => f.properties.name !== correct);
  const sameKind = others.filter((f) => f.properties.kind === target.properties.kind);
  const alike = (f: Quizzable) => looksAlike(f.properties.name, correct);
  let ranked: Quizzable[];
  if (tier === 0) ranked = shuffle(others.slice(Math.floor(others.length / 2)).filter((f) => !alike(f)), rand);
  else if (tier === 1) ranked = shuffle(sameKind.filter((f) => !alike(f)), rand);
  else ranked = [...sameKind.filter(alike), ...sameKind.filter((f) => !alike(f))];

  const want = Math.min(OPTION_COUNT - 1, new Set(all.map((f) => f.properties.name)).size - 1);
  const names: string[] = [];
  for (const f of [...ranked, ...shuffle(others, rand)]) {
    if (names.length >= want) break;
    if (!names.includes(f.properties.name)) names.push(f.properties.name);
  }
  return shuffle([correct, ...names], rand);
}

export function percentOf(correct: number, total: number): number {
  return total === 0 ? 0 : Math.floor((correct * 100) / total);
}

export function binIndex(percent: number): number {
  let index = 0;
  BINS.forEach((b, i) => {
    if (percent >= b.min) index = i;
  });
  return index;
}

export function isPass(percent: number): boolean {
  return percent >= PASS_PERCENT;
}

/** Correct answers still needed to reach the next bin, or null at the top. */
export function toNextBin(correct: number, total: number): { bin: number; needed: number } | null {
  const next = binIndex(percentOf(correct, total)) + 1;
  if (next >= BINS.length || total === 0) return null;
  return { bin: next, needed: Math.ceil((BINS[next].min * total) / 100) - correct };
}
