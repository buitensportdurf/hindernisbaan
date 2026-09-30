<script lang="ts">
  import { onMount } from 'svelte';
  import { t, tf, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import BinRidge from './BinRidge.svelte';
  import ProgressChart from './ProgressChart.svelte';
  import { binName } from './bins';
  import { REVEAL_MS } from './reveal';
  import { binIndex, isPass, percentOf } from './quiz';
  import type { RunRecord } from './runs';
  import type { Soundboard } from './sound';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    locale,
    run,
    runs,
    mistakes,
    sound,
    reducedMotion = false,
    onMap,
    onPractice,
    onReport,
    onClose
  }: {
    locale: Locale;
    run: RunRecord;
    /** All saved runs, oldest first, including this one. */
    runs: RunRecord[];
    mistakes: number;
    sound: Soundboard;
    reducedMotion?: boolean;
    onMap: () => void;
    onPractice: () => void;
    onReport: () => void;
    onClose: () => void;
  } = $props();

  /** When each part of the reveal appears, in ms after mount. */
  const STAGES = [REVEAL_MS.score, REVEAL_MS.ridge, REVEAL_MS.title, REVEAL_MS.caption, REVEAL_MS.actions] as const;
  const COUNT_MS = 850;
  const CHART_MIN_RUNS = 3;
  const CHART_MAX_RUNS = 8;

  const percent = $derived(percentOf(run.correct, run.total));
  const pass = $derived(isPass(percent));
  const bin = $derived(binIndex(percent));
  const earlier = $derived(runs.filter((r) => r.id !== run.id));
  const previous = $derived(earlier.length ? percentOf(earlier.at(-1)!.correct, earlier.at(-1)!.total) : null);
  const chartPercents = $derived(
    runs.length >= CHART_MIN_RUNS ? runs.slice(-CHART_MAX_RUNS).map((r) => percentOf(r.correct, r.total)) : null
  );
  const delta = $derived.by(() => {
    if (previous === null) return { text: t(locale, 'test.result.first'), tone: 'flat' };
    const d = percent - previous;
    if (d > 0) return { text: tf(locale, 'test.result.up', { n: d }), tone: 'up' };
    if (d < 0) return { text: tf(locale, 'test.result.down', { n: -d }), tone: 'down' };
    return { text: t(locale, 'test.result.same'), tone: 'flat' };
  });

  let stage = $state(0);
  let shownPercent = $state(0);
  let closeButton = $state<HTMLButtonElement | null>(null);
  let ridgeHighlight = $state<number | null>(null);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let countFrame = 0;

  function countUp() {
    if (reducedMotion) {
      shownPercent = percent;
      return;
    }
    const start = performance.now();
    countFrame = requestAnimationFrame(function step(now) {
      const p = Math.min(1, (now - start) / COUNT_MS);
      shownPercent = Math.round(percent * (1 - Math.pow(1 - p, 3)));
      if (p < 1) countFrame = requestAnimationFrame(step);
    });
  }

  function enter(next: number) {
    if (next <= stage) return;
    const from = stage;
    stage = next;
    if (from < 1) countUp();
    if (from < 3 && next >= 3) pass ? sound.fanfare() : sound.finish();
  }

  function skip() {
    if (stage >= STAGES.length) return;
    timers.forEach(clearTimeout);
    cancelAnimationFrame(countFrame);
    enter(STAGES.length);
    shownPercent = percent;
  }

  onMount(() => {
    closeButton?.focus({ preventScroll: true });
    if (reducedMotion) {
      enter(STAGES.length);
    } else {
      STAGES.forEach((ms, i) => timers.push(setTimeout(() => enter(i + 1), ms)));
    }
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(countFrame);
    };
  });

  const confetti = Array.from({ length: 38 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.7,
    duration: 2.4 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 80,
    spin: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360),
    color: ['#ffffff', '#8fd9f3', '#f3dfa6', '#b9dcb9', '#ffffff'][i % 5],
    round: i % 3 === 0
  }));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- Tapping anywhere fast-forwards the reveal. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class={cn('reveal', pass ? 'reveal--pass' : 'reveal--low')}
  role="dialog"
  aria-modal="true"
  aria-labelledby="reveal-bin"
  tabindex="-1"
  onclick={skip}
>
  {#if pass && stage >= 3 && !reducedMotion}
    <div class="confetti" aria-hidden="true">
      {#each confetti as c, i (i)}
        <i
          class:round={c.round}
          style:left={`${c.left}%`}
          style:background={c.color}
          style:animation-delay={`${c.delay}s`}
          style:animation-duration={`${c.duration}s`}
          style:--drift={`${c.drift}px`}
          style:--spin={`${c.spin}deg`}
        ></i>
      {/each}
    </div>
  {/if}

  <button
    bind:this={closeButton}
    type="button"
    class="close"
    aria-label={t(locale, 'test.close')}
    onclick={(e) => {
      e.stopPropagation();
      onClose();
    }}
  >
    <XIcon />
  </button>

  <div class="body">
    <div class="hero">
      <p class="lead stage" class:in={stage >= 3}>{t(locale, 'test.result.lead')}</p>
      <h1 id="reveal-bin" class="bin" class:in={stage >= 3}>
        <button
          type="button"
          class="bin-btn"
          aria-label={tf(locale, 'test.bin.showScale', { bin: binName(locale, bin) })}
          onclick={(e) => {
            e.stopPropagation();
            ridgeHighlight = bin;
          }}
        >
          {binName(locale, bin)}
        </button>
      </h1>
      <p class="pct stage" class:in={stage >= 1}>{shownPercent}%</p>
      <button
        type="button"
        class="score stage"
        class:in={stage >= 1}
        aria-label={`${tf(locale, 'test.result.score', { correct: run.correct, total: run.total })}. ${t(locale, 'test.result.scoreHint')}`}
        onclick={(e) => {
          e.stopPropagation();
          skip();
          onReport();
        }}
      >
        {tf(locale, 'test.result.score', { correct: run.correct, total: run.total })}
        <ChevronRightIcon />
      </button>
    </div>

    <div class="card stage" class:in={stage >= 2}>
      <BinRidge
        {locale}
        correct={run.correct}
        total={run.total}
        {previous}
        climb={stage >= 2}
        showCaption={stage >= 4}
        {reducedMotion}
        highlight={ridgeHighlight}
      />
      <div class="trend stage" class:in={stage >= 4}>
        <p class={cn('delta', `delta--${delta.tone}`)}>
          {#if previous !== null}<span class="prev-ring" aria-hidden="true"></span>{/if}
          {delta.text}
        </p>
        {#if chartPercents}
          <ProgressChart {locale} percents={chartPercents} />
        {/if}
      </div>
    </div>

    <div class="actions stage" class:in={stage >= 5}>
      <Button
        class="w-full"
        variant={pass ? 'secondary' : 'default'}
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
          onMap();
        }}
      >
        {t(locale, 'test.result.map')}
      </Button>
      {#if mistakes > 0}
        <Button
          class="w-full"
          variant="outline"
          size="sm"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            onPractice();
          }}
        >
          {mistakes === 1
            ? t(locale, 'test.result.practice.one')
            : tf(locale, 'test.result.practice', { n: mistakes })}
        </Button>
      {/if}
    </div>
  </div>
</div>

<style>
  .reveal {
    position: fixed;
    inset: 0;
    z-index: 1300;
    overflow-x: hidden;
    overflow-y: auto;
    outline: none;
    animation: reveal-in 260ms ease-out both;
  }
  .reveal--pass {
    background: var(--success);
    color: var(--white);
  }
  .reveal--low {
    background: var(--sand-100);
    color: var(--ink-800);
  }

  .close {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    color: inherit;
    opacity: 0.75;
    transition: opacity 120ms ease-out, background-color 120ms ease-out;
  }
  .close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }
  .close:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 1px;
  }
  .close :global(svg) {
    width: 22px;
    height: 22px;
  }

  .body {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 100%;
    max-width: 440px;
    margin: 0 auto;
    padding: 64px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  }
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 220px;
  }

  .stage {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 380ms ease-out, transform 460ms var(--ease-out);
  }
  .stage.in {
    opacity: 1;
    transform: none;
  }

  .lead {
    font-size: 17px;
    font-weight: var(--fw-semibold);
    opacity: 0;
  }
  .lead.in {
    opacity: 0.85;
  }
  .bin {
    margin-top: 4px;
    font-size: clamp(40px, 12vw, 54px);
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1;
    text-wrap: balance;
    opacity: 0;
    transform: scale(0.6);
  }
  .bin.in {
    animation: bin-pop 520ms var(--ease-bounce) both;
  }
  .bin-btn {
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-align: inherit;
    text-wrap: inherit;
    border-radius: 8px;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 6px;
    text-decoration-thickness: 1px;
  }
  .bin-btn:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }
  .reveal--low .bin {
    color: var(--sand-700);
  }
  .pct {
    margin-top: 10px;
    font-size: 76px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .score {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-top: 12px;
    padding: 8px 10px 8px 16px;
    border-radius: 99px;
    font-size: 16px;
    font-weight: var(--fw-semibold);
    color: inherit;
    transition: background-color 140ms ease-out, opacity 380ms ease-out, transform 460ms var(--ease-out);
  }
  .reveal--pass .score {
    background: rgba(255, 255, 255, 0.14);
  }
  .reveal--pass .score:hover {
    background: rgba(255, 255, 255, 0.22);
  }
  .reveal--low .score {
    background: rgba(84, 55, 30, 0.08);
  }
  .reveal--low .score:hover {
    background: rgba(84, 55, 30, 0.14);
  }
  .score:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
  .score :global(svg) {
    width: 18px;
    height: 18px;
    opacity: 0.8;
  }

  .card {
    padding: 16px 16px 14px;
    background: var(--white);
    color: var(--ink-800);
    border-radius: 20px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
  }
  .trend {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--quiz-line);
  }
  .delta {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: var(--fw-semibold);
    color: var(--ink-500);
  }
  .delta--up {
    color: var(--success);
  }
  .delta--down {
    color: var(--error);
  }
  .prev-ring {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
    border: 2px solid var(--ink-500);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Laptop-height windows: keep both actions above the fold. */
  @media (max-height: 820px) {
    .body {
      gap: 14px;
      padding-top: 52px;
    }
    .hero {
      min-height: 0;
    }
    .bin {
      font-size: clamp(36px, 10vw, 44px);
    }
    .pct {
      margin-top: 6px;
      font-size: 60px;
    }
  }

  .confetti {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .confetti i {
    position: absolute;
    top: -16px;
    width: 7px;
    height: 13px;
    border-radius: 2px;
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.3, 0.4, 0.6, 1);
    animation-fill-mode: both;
  }
  .confetti i.round {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  @keyframes reveal-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes bin-pop {
    0% { opacity: 0; transform: scale(0.6); }
    60% { opacity: 1; }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes fall {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translate(var(--drift), 105vh) rotate(var(--spin)); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal {
      animation: none;
    }
    .stage,
    .bin {
      transform: none;
      transition: opacity 160ms linear;
    }
    .bin.in {
      animation: none;
      opacity: 1;
    }
  }
</style>
