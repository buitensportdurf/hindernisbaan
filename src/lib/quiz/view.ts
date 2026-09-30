/** Label on a feature the run already asked: earned, missed, or missed with its name shown. */
export type StampKind = 'known' | 'missed' | 'reveal';

/** What the quiz map shows right now. */
export interface QuizView {
  /** Changing this moves the camera. */
  frameKey: string;
  /** Features to frame; empty frames the whole course. */
  frameIds: string[];
  /** Extra point in the frame so Find it is not centred on the answer. */
  frameShift?: [number, number] | null;
  maxZoom: number;
  /** Highlighted with the selection glow. */
  targetId: string | null;
  /** Pulsing outline around the target. */
  halo: boolean;
  /** Fade everything except the target. */
  dimOthers: boolean;
  /** Find it: the shape the user tapped. */
  pickedId: string | null;
  /** Find it feedback: the right tap, turned green. */
  rightId: string | null;
  /** Find it feedback: the wrong tap, turned red. */
  wrongId: string | null;
  /** Shapes respond to taps. */
  tappable: boolean;
  hideLandmarks: boolean;
}
