<script lang="ts">
  import { t, tf, type Locale } from '$lib/i18n';
  import { BIN_COLORS, BIN_HEIGHTS, binName, binRange, ridgeHeight } from './bins';
  import { BINS, PASS_PERCENT, binIndex, isPass, percentOf, toNextBin } from './quiz';
  import { CLIMB_MS } from './reveal';

  let {
    locale,
    correct,
    total,
    previous = null,
    climb,
    showCaption,
    reducedMotion = false,
    highlight = null
  }: {
    locale: Locale;
    correct: number;
    total: number;
    /** Score of the run before, drawn as a hollow ring. */
    previous?: number | null;
    /** Start the marker's walk up the mountain. */
    climb: boolean;
    showCaption: boolean;
    reducedMotion?: boolean;
    /** Parent can point at a band — used when the rank title is tapped. */
    highlight?: number | null;
  } = $props();

  const percent = $derived(percentOf(correct, total));
  const current = $derived(binIndex(percent));
  let shown = $state(0);
  let selected = $state<number | null>(null);

  $effect(() => {
    if (highlight !== null) selected = highlight;
  });

  $effect(() => {
    if (!climb) return;
    const target = percent;
    if (reducedMotion) {
      shown = target;
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const p = Math.min(1, (now - start) / CLIMB_MS);
      shown = target * (1 - Math.pow(1 - p, 3));
      if (p < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  });

  const reached = $derived(binIndex(shown));
  const focus = $derived(selected ?? current);
  const focusRange = $derived(binRange(focus));
  const focusName = $derived(binName(locale, focus));

  const hint = $derived.by(() => {
    if (focus === current) {
      const next = toNextBin(correct, total);
      return next
        ? tf(locale, 'test.result.next', { n: next.needed, bin: binName(locale, next.bin) })
        : t(locale, 'test.result.top');
    }
    if (focus < current) return '';
    const needed = Math.ceil((BINS[focus].min * total) / 100) - correct;
    return tf(locale, 'test.result.next', { n: needed, bin: focusName });
  });
</script>

<div class="ridge">
  <div class="peaks">
    {#each BINS as bin, i (bin.key)}
      {@const range = binRange(i)}
      <button
        type="button"
        class="step"
        class:reached={climb && i <= reached}
        class:now={climb && i === reached}
        class:first={i === 0}
        class:last={i === BINS.length - 1}
        style:left={`${range.from}%`}
        style:width={`${range.to - range.from}%`}
        style:height={`${BIN_HEIGHTS[i]}px`}
        style:background={BIN_COLORS[i]}
        aria-label={`${binName(locale, i)}, ${tf(locale, 'test.result.range', range)}`}
        aria-pressed={selected === i}
        onclick={(e) => {
          e.stopPropagation();
          selected = selected === i ? null : i;
        }}
      >
        {#if climb && i <= reached}
          <span class="step-name">{binName(locale, i)}</span>
        {/if}
      </button>
    {/each}

    <span class="threshold" style:left={`${PASS_PERCENT}%`} aria-hidden="true"></span>

    {#if previous !== null}
      <span
        class="prev"
        style:left={`${previous}%`}
        style:bottom={`${ridgeHeight(previous) + 5}px`}
        aria-hidden="true"
      ></span>
    {/if}
    <span
      class="you"
      class:visible={climb}
      style:left={`${shown}%`}
      style:bottom={`${ridgeHeight(shown) + 5}px`}
      aria-hidden="true"
    ></span>
  </div>

  <div class="ticks" aria-hidden="true">
    <span>0%</span>
    <span class="pass" style:left={`${PASS_PERCENT}%`}>{PASS_PERCENT}% · {t(locale, 'test.result.threshold')}</span>
    <span class="end">100%</span>
  </div>

  <div class="caption" class:in={showCaption} aria-live="polite">
    <p class="cap-main">
      <b class:green={isPass(focusRange.from)}>{focusName}</b>
      · {tf(locale, 'test.result.range', focusRange)}
    </p>
    <p class="cap-sub">{hint || '\u00a0'}</p>
  </div>
</div>

<style>
  .ridge {
    position: relative;
  }
  .peaks {
    position: relative;
    height: 108px;
  }
  .step {
    position: absolute;
    bottom: 0;
    border-left: 2px solid var(--white);
    border-radius: 5px 5px 0 0;
    opacity: 0.5;
    transition: opacity 240ms ease-out, filter 160ms ease-out;
    cursor: pointer;
  }
  .step.first {
    border-left: 0;
  }
  .step.reached {
    opacity: 1;
  }
  .step.now {
    z-index: 2;
  }
  .step-name {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 4px);
    width: max-content;
    max-width: 7.5rem;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--ink-700);
    text-align: center;
    text-wrap: balance;
    pointer-events: none;
    opacity: 0.85;
  }
  .step.first .step-name {
    left: 0;
    transform: none;
    text-align: left;
  }
  .step.last .step-name {
    left: auto;
    right: 0;
    transform: none;
    text-align: right;
  }
  .step.now .step-name {
    font-size: 12px;
    opacity: 1;
    color: var(--ink-800);
  }
  .step[aria-pressed='true'] {
    filter: brightness(0.92);
  }
  .step:focus-visible {
    outline: 2px solid var(--bok-700);
    outline-offset: 2px;
    z-index: 1;
  }

  .threshold {
    position: absolute;
    top: 6px;
    bottom: 0;
    border-left: 1.5px dashed rgba(35, 35, 35, 0.35);
    pointer-events: none;
  }

  .you,
  .prev {
    position: absolute;
    border-radius: 50%;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .you {
    width: 18px;
    height: 18px;
    background: var(--bok-500);
    border: 3px solid var(--white);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    opacity: 0;
    transition: bottom 140ms var(--ease-out), opacity 200ms ease-out;
  }
  .you.visible {
    opacity: 1;
  }
  .prev {
    width: 12px;
    height: 12px;
    background: var(--white);
    border: 2px solid var(--ink-500);
  }

  .ticks {
    position: relative;
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    height: 16px;
    font-size: 11px;
    font-weight: var(--fw-medium);
    color: var(--gray-500);
    font-variant-numeric: tabular-nums;
  }
  .ticks .pass {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
    font-weight: var(--fw-bold);
    color: var(--success);
  }

  .caption {
    margin-top: 12px;
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 320ms ease-out, transform 360ms var(--ease-out);
  }
  .caption.in {
    opacity: 1;
    transform: none;
  }
  .cap-main {
    font-size: 15px;
    color: var(--ink-600);
  }
  .cap-main b {
    font-weight: 800;
    color: var(--sand-700);
  }
  .cap-main b.green {
    color: var(--success);
  }
  .cap-sub {
    margin-top: 2px;
    font-size: 13px;
    color: var(--ink-500);
  }

  @media (prefers-reduced-motion: reduce) {
    .caption {
      transform: none;
    }
  }
</style>
