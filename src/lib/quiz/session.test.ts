import { describe, it, expect, beforeEach } from 'vitest';
import type { Question } from './quiz';
import { createQuizSession } from './session.svelte';
import { LENGTH_KEY, MAX_RUNS, RUNS_KEY, loadFsOn, loadRunLength, loadRuns, saveFsOn, saveRun, saveRunLength, type RunRecord } from './runs';

const names = new Map([
  ['a', 'Apenkooi'],
  ['b', 'Notenkraker'],
  ['c', 'Paalklim']
]);

function q(targetId: string, type: 'name' | 'find', timeLimitMs: number | null = 20_000): Question {
  return {
    tier: 0,
    type,
    targetId,
    options: type === 'name' ? ['Apenkooi', 'Notenkraker', 'Paalklim', 'Touwkruis'] : [],
    frameIds: [targetId],
    maxZoom: 19,
    hideLandmarks: false,
    timeLimitMs
  };
}

describe('createQuizSession', () => {
  it('scores Name it by name and Find it by feature', () => {
    const s = createQuizSession({ questions: [q('a', 'name'), q('b', 'find')], names, now: 0 });
    s.pick('Apenkooi');
    expect(s.check(1_000)).toBe('correct');
    expect(s.phase).toBe('feedback');
    s.next(2_000);
    s.pick('c');
    expect(s.check(3_000)).toBe('wrong');
    expect(s.lastAnswer).toMatchObject({ featureId: 'b', outcome: 'wrong', picked: 'c', pickedName: 'Paalklim', ms: 1_000 });
    s.next(4_000);
    expect(s.phase).toBe('done');
    expect(s.correctCount).toBe(1);
  });

  it('needs a pick before checking', () => {
    const s = createQuizSession({ questions: [q('a', 'name')], names, now: 0 });
    expect(s.check(100)).toBeNull();
    expect(s.phase).toBe('question');
  });

  it('times out strictly, even with an unchecked pick', () => {
    const s = createQuizSession({ questions: [q('a', 'name')], names, now: 0 });
    s.pick('Apenkooi');
    expect(s.tick(19_999)).toBeNull();
    expect(s.remainingMs(15_000)).toBe(5_000);
    expect(s.tick(20_000)).toBe('timeout');
    expect(s.lastAnswer).toMatchObject({ outcome: 'timeout', picked: null, ms: 20_000 });
    expect(s.streak).toBe(0);
  });

  it('stops the clock while paused', () => {
    const s = createQuizSession({ questions: [q('a', 'name')], names, now: 0 });
    s.pause(5_000);
    expect(s.tick(30_000)).toBeNull();
    s.resume(30_000);
    expect(s.remainingMs(30_000)).toBe(15_000);
    expect(s.tick(44_999)).toBeNull();
    expect(s.tick(45_000)).toBe('timeout');
  });

  it('tracks the streak', () => {
    const s = createQuizSession({ questions: [q('a', 'name'), q('b', 'name'), q('c', 'name')], names, now: 0 });
    for (const pick of ['Apenkooi', 'Notenkraker']) {
      s.pick(pick);
      s.check(1);
      s.next(2);
    }
    expect(s.streak).toBe(2);
    s.pick('Apenkooi');
    s.check(3);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(2);
  });

  it('brings missed practice questions back at the end', () => {
    const s = createQuizSession({ questions: [q('a', 'name', null)], names, now: 0, practice: true });
    expect(s.remainingMs(1e9)).toBeNull();
    expect(s.tick(1e9)).toBeNull();
    s.pick('Paalklim');
    s.check(1);
    s.next(2);
    expect(s.phase).toBe('question');
    expect(s.index).toBe(1);
    s.pick('Apenkooi');
    s.check(3);
    s.next(4);
    expect(s.phase).toBe('done');
  });

  it('ends the run at the 15-minute cap', () => {
    const s = createQuizSession({ questions: [q('a', 'name', null), q('b', 'name', null)], names, now: 0 });
    expect(s.tick(15 * 60_000)).toBe('expired');
    expect(s.phase).toBe('done');
    expect(s.answers.map((a) => a.outcome)).toEqual(['timeout', 'timeout']);
  });

  it('builds a record for storage', () => {
    const s = createQuizSession({ questions: [q('a', 'name')], names, now: 0, seed: 9, dataVersion: '2026-09-28' });
    s.pick('Apenkooi');
    s.check(4_000);
    s.next(6_000);
    const r = s.toRecord();
    expect(r).toMatchObject({ v: 1, seed: 9, dataVersion: '2026-09-28', correct: 1, total: 1, durationMs: 6_000 });
    expect(r.answers).toHaveLength(1);
  });
});

describe('runs storage', () => {
  beforeEach(() => localStorage.clear());

  const run = (id: string): RunRecord => ({
    v: 1,
    id,
    startedAt: '2026-09-30T10:00:00.000Z',
    durationMs: 1,
    seed: 1,
    dataVersion: null,
    correct: 1,
    total: 20,
    answers: []
  });

  it('keeps the newest runs', () => {
    for (let i = 0; i < MAX_RUNS + 3; i++) saveRun(run(`r${i}`));
    const runs = loadRuns();
    expect(runs).toHaveLength(MAX_RUNS);
    expect(runs.at(-1)!.id).toBe(`r${MAX_RUNS + 2}`);
  });

  it('skips unreadable data', () => {
    localStorage.setItem(RUNS_KEY, 'nope');
    expect(loadRuns()).toEqual([]);
    localStorage.setItem(RUNS_KEY, JSON.stringify([run('ok'), { v: 2 }, null]));
    expect(loadRuns().map((r) => r.id)).toEqual(['ok']);
  });

  it('defaults question count to 20 when nothing is stored', () => {
    expect(loadRunLength()).toBe(20);
    localStorage.setItem(LENGTH_KEY, '0');
    expect(loadRunLength()).toBe(20);
    saveRunLength(10);
    expect(loadRunLength()).toBe(10);
    saveRunLength(20);
    expect(loadRunLength()).toBe(20);
  });

  it('defaults to auto fullscreen and can be suppressed', () => {
    expect(loadFsOn()).toBe(true);
    saveFsOn(false);
    expect(loadFsOn()).toBe(false);
    saveFsOn(true);
    expect(loadFsOn()).toBe(true);
  });
});
