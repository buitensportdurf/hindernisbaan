import { readKey, writeKey } from '$lib/storage/local';
import { clampRunLength, type Outcome, type QuestionType, type RunLength } from './quiz';

export const RUNS_KEY = 'durf:test:runs';
export const SOUND_KEY = 'durf:test:sound';
export const LENGTH_KEY = 'durf:test:length';
export const MAX_RUNS = 50;

export interface AnswerRecord {
  featureId: string;
  /** Name at the time of the run, so old runs still read after the course changes. */
  name: string;
  type: QuestionType;
  tier: number;
  outcome: Outcome;
  ms: number;
  /** Name it: the name picked. Find it: the feature id tapped. */
  picked: string | null;
  /** Find it: name of the feature tapped. */
  pickedName?: string | null;
}

export interface RunRecord {
  v: 1;
  id: string;
  startedAt: string;
  durationMs: number;
  seed: number;
  dataVersion: string | null;
  correct: number;
  total: number;
  answers: AnswerRecord[];
}

function isRun(value: unknown): value is RunRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<RunRecord>;
  return (
    r.v === 1 &&
    typeof r.id === 'string' &&
    typeof r.startedAt === 'string' &&
    typeof r.correct === 'number' &&
    typeof r.total === 'number' &&
    r.total > 0 &&
    Array.isArray(r.answers)
  );
}

/** Saved runs, oldest first. Unreadable entries are skipped. */
export function loadRuns(): RunRecord[] {
  const raw = readKey(RUNS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRun) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: RunRecord): RunRecord[] {
  const runs = [...loadRuns().filter((r) => r.id !== run.id), run].slice(-MAX_RUNS);
  writeKey(RUNS_KEY, JSON.stringify(runs));
  return runs;
}

export function loadSoundOn(): boolean {
  return readKey(SOUND_KEY) !== 'off';
}

export function saveSoundOn(on: boolean): void {
  writeKey(SOUND_KEY, on ? 'on' : 'off');
}

export function loadRunLength(): RunLength {
  const n = Number(readKey(LENGTH_KEY));
  return clampRunLength(Number.isFinite(n) ? n : NaN);
}

export function saveRunLength(length: RunLength): void {
  writeKey(LENGTH_KEY, String(length));
}
