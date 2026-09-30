import { RUN_CAP_MS, type Outcome, type Question } from './quiz';
import type { AnswerRecord, RunRecord } from './runs';

export type SessionPhase = 'question' | 'feedback' | 'done';

/** A practice question that is missed again comes back at the end, at most this often. */
const PRACTICE_REPEATS = 2;

export function createQuizSession(options: {
  questions: Question[];
  /** Feature id → name, for checking Name it answers and for the saved record. */
  names: Map<string, string>;
  /** `performance.now()`-style clock value at the start of the run. */
  now: number;
  practice?: boolean;
  seed?: number;
  dataVersion?: string | null;
}) {
  const { names, practice = false, seed = 0, dataVersion = null } = options;
  const startedAt = new Date();
  const runStart = options.now;

  let questions = $state<Question[]>([...options.questions]);
  let index = $state(0);
  let phase = $state<SessionPhase>(questions.length > 0 ? 'question' : 'done');
  let picked = $state<string | null>(null);
  let streak = $state(0);
  let bestStreak = $state(0);
  let answers = $state<AnswerRecord[]>([]);

  let questionStart = options.now;
  let pausedAt: number | null = null;
  let pausedTotal = 0;
  let finishedAt: number | null = null;
  const repeats = new Map<string, number>();

  const current = () => questions[index] ?? null;

  function deadline(): number | null {
    const q = current();
    return q && q.timeLimitMs !== null ? questionStart + q.timeLimitMs : null;
  }

  function record(q: Question, outcome: Outcome, ms: number, pick: string | null): void {
    answers.push({
      featureId: q.targetId,
      name: names.get(q.targetId) ?? '',
      type: q.type,
      tier: q.tier,
      outcome,
      ms: Math.max(0, Math.round(ms)),
      picked: pick,
      pickedName: q.type === 'find' && pick ? (names.get(pick) ?? null) : null
    });
  }

  function settle(outcome: Outcome, at: number): Outcome {
    const q = current()!;
    // Strict: an answer picked but not checked in time still counts as no answer.
    record(q, outcome, at - questionStart, outcome === 'timeout' ? null : picked);
    if (outcome === 'correct') {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
      if (practice) {
        const n = repeats.get(q.targetId) ?? 0;
        if (n < PRACTICE_REPEATS) {
          repeats.set(q.targetId, n + 1);
          questions.push(q);
        }
      }
    }
    phase = 'feedback';
    return outcome;
  }

  function finish(at: number): void {
    phase = 'done';
    finishedAt = at;
  }

  return {
    get practice() {
      return practice;
    },
    get questions() {
      return questions;
    },
    get index() {
      return index;
    },
    get current() {
      return current();
    },
    get phase() {
      return phase;
    },
    get picked() {
      return picked;
    },
    get streak() {
      return streak;
    },
    get bestStreak() {
      return bestStreak;
    },
    get answers() {
      return answers;
    },
    get lastAnswer(): AnswerRecord | null {
      return answers[answers.length - 1] ?? null;
    },
    get correctCount() {
      return answers.filter((a) => a.outcome === 'correct').length;
    },
    get mistakes(): Question[] {
      const missed = new Set(answers.filter((a) => a.outcome !== 'correct').map((a) => a.featureId));
      return questions.filter((q) => missed.has(q.targetId));
    },

    /** Milliseconds left on the current question's clock, or null when it is untimed. */
    remainingMs(now: number): number | null {
      const d = deadline();
      if (d === null) return null;
      return Math.max(0, d - (pausedAt ?? now));
    },

    pick(value: string): void {
      if (phase === 'question') picked = value;
    },

    check(now: number): Outcome | null {
      const q = current();
      if (phase !== 'question' || !q || picked === null) return null;
      const right = q.type === 'name' ? picked === names.get(q.targetId) : picked === q.targetId;
      return settle(right ? 'correct' : 'wrong', now);
    },

    /** Advance the clock; returns 'timeout' when the question ran out, 'expired' when the run did. */
    tick(now: number): 'timeout' | 'expired' | null {
      if (phase !== 'question' || pausedAt !== null) return null;
      if (!practice && now - runStart - pausedTotal >= RUN_CAP_MS) {
        for (let i = index; i < questions.length; i++) record(questions[i], 'timeout', 0, null);
        finish(now);
        return 'expired';
      }
      const d = deadline();
      if (d !== null && now >= d) {
        settle('timeout', d);
        return 'timeout';
      }
      return null;
    },

    next(now: number): void {
      if (phase !== 'feedback') return;
      if (index + 1 >= questions.length) {
        finish(now);
        return;
      }
      index += 1;
      picked = null;
      questionStart = now;
      phase = 'question';
    },

    pause(now: number): void {
      if (pausedAt === null) pausedAt = now;
    },

    resume(now: number): void {
      if (pausedAt === null) return;
      const paused = now - pausedAt;
      questionStart += paused;
      pausedTotal += paused;
      pausedAt = null;
    },

    toRecord(): RunRecord {
      const end = finishedAt ?? runStart;
      return {
        v: 1,
        id: `${startedAt.getTime().toString(36)}-${(seed >>> 0).toString(36)}`,
        startedAt: startedAt.toISOString(),
        durationMs: Math.max(0, Math.round(end - runStart - pausedTotal)),
        seed,
        dataVersion,
        correct: answers.filter((a) => a.outcome === 'correct').length,
        total: questions.length,
        answers: $state.snapshot(answers)
      };
    }
  };
}

export type QuizSession = ReturnType<typeof createQuizSession>;
