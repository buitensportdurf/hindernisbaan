type ToneOptions = { type?: OscillatorType; gain?: number; to?: number };

/** Small synthesized sound set, so the test ships without audio files. */
export function createSoundboard(isOn: () => boolean) {
  let ctx: AudioContext | null = null;

  function context(): AudioContext | null {
    if (!isOn() || typeof window === 'undefined') return null;
    if (!ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq: number, delay: number, duration: number, { type = 'sine', gain = 0.16, to }: ToneOptions = {}) {
    const ac = context();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    /** Browsers only allow audio after a user gesture; call this from one. */
    unlock() {
      context();
    },
    stamp() {
      tone(520, 0, 0.07, { type: 'triangle', gain: 0.22, to: 260 });
    },
    correct() {
      tone(784, 0.06, 0.14);
      tone(1175, 0.15, 0.26);
    },
    wrong() {
      tone(233, 0, 0.26, { type: 'triangle', gain: 0.2, to: 150 });
    },
    timeout() {
      tone(440, 0, 0.16, { type: 'triangle', gain: 0.14 });
      tone(330, 0.14, 0.3, { type: 'triangle', gain: 0.14 });
    },
    tick() {
      tone(1760, 0, 0.035, { gain: 0.05 });
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, i === 3 ? 0.5 : 0.18, { type: 'triangle', gain: 0.14 }));
    },
    finish() {
      tone(523, 0, 0.2, { type: 'triangle', gain: 0.12 });
      tone(659, 0.14, 0.34, { type: 'triangle', gain: 0.12 });
    }
  };
}

export type Soundboard = ReturnType<typeof createSoundboard>;

/** Android vibration; iOS Safari has no vibration API and ignores this. */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
