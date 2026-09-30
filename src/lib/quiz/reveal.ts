/** Climb duration for the result ridge; title waits until this has landed. */
export const CLIMB_MS = 1600;

export const REVEAL_MS = {
  score: 120,
  ridge: 400,
  title: 400 + CLIMB_MS + 200,
  caption: 2550,
  actions: 2950
} as const;
