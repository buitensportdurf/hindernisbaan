<script lang="ts">
  import { t, tf, type Locale } from '$lib/i18n';
  import { BIN_COLORS, BIN_HEIGHTS, BIN_LABEL_COLORS, binName, binRange, ridgeHeight } from './bins';
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
      ></button>
    {/each}

    <span class="threshold" style:left={`${PASS_PERCENT}%`} aria-hidden="true"></span>

    {#if previous !== null}
      <span class="pin prev" style:left={`${previous}%`} style:bottom={`${ridgeHeight(previous)}px`} aria-hidden="true">
        <svg viewBox="0 0 32 42">
          <path
            d="M16 2c-7.3 0-13.2 5.8-13.2 12.9 0 10 13.2 25.1 13.2 25.1s13.2-15.1 13.2-25.1C29.2 7.8 23.3 2 16 2z"
          />
        </svg>
      </span>
    {/if}
    <span
      class="pin you"
      class:visible={climb}
      style:left={`${shown}%`}
      style:bottom={`${ridgeHeight(shown)}px`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 42">
        <path
          d="M16 2c-7.3 0-13.2 5.8-13.2 12.9 0 10 13.2 25.1 13.2 25.1s13.2-15.1 13.2-25.1C29.2 7.8 23.3 2 16 2z"
        />
        <circle cx="16" cy="14.5" r="5.2" />
      </svg>
    </span>
  </div>

  <div class="names" aria-hidden="true">
    {#each BINS as bin, i (bin.key)}
      {@const range = binRange(i)}
      <span
        class="bin-label"
        class:first={i === 0}
        class:last={i === BINS.length - 1}
        style:left={i === BINS.length - 1 ? undefined : `${range.from}%`}
        style:width={i === BINS.length - 1 ? undefined : i === 4 ? `${100 - range.from}%` : `${range.to - range.from}%`}
        style:color={BIN_LABEL_COLORS[i]}
      >
        {binName(locale, i)}
      </span>
    {/each}
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
    height: 110px;
    overflow: visible;
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

  .pin {
    position: absolute;
    width: 32px;
    height: 42px;
    transform: translate(-50%, 6px);
    pointer-events: none;
    z-index: 3;
  }
  .pin svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .pin path {
    fill: currentColor;
    stroke: var(--white);
    stroke-width: 2.6;
    stroke-linejoin: round;
  }
  .you {
    color: var(--bok-500);
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
    opacity: 0;
    transition: bottom 140ms var(--ease-out), opacity 200ms ease-out;
  }
  .you circle {
    fill: var(--white);
  }
  .you.visible {
    opacity: 1;
  }
  .prev {
    color: var(--white);
    width: 24px;
    height: 32px;
    transform: translate(-50%, 5px);
  }
  .prev path {
    stroke: var(--ink-500);
    stroke-width: 2.2;
  }

  .names {
    position: relative;
    min-height: 3.5em;
    margin-top: 8px;
  }
  .bin-label {
    position: absolute;
    top: 0;
    padding: 0 3px;
    font-size: 9px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.02em;
    text-align: center;
    text-wrap: balance;
  }
  .bin-label.first {
    text-align: left;
    padding-left: 0;
  }
  .bin-label.last {
    top: 2.3em;
    right: 0;
    width: max-content;
    text-align: right;
    padding-right: 0;
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
