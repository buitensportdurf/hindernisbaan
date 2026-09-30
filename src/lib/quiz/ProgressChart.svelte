<script lang="ts">
  import { t, tf, type Locale } from '$lib/i18n';
  import { PASS_PERCENT } from './quiz';

  let { locale, percents }: { locale: Locale; percents: number[] } = $props();

  const H = 120;
  const PAD = { top: 18, right: 38, bottom: 6, left: 4 };

  let width = $state(0);

  const y = (p: number) => PAD.top + ((100 - p) / 100) * (H - PAD.top - PAD.bottom);
  const x = (i: number) =>
    percents.length < 2
      ? width / 2
      : PAD.left + (i * (width - PAD.left - PAD.right)) / (percents.length - 1);

  const points = $derived(percents.map((p, i) => `${x(i)},${y(p)}`).join(' '));
  const last = $derived(percents.length - 1);
  const passLabel = $derived(`${PASS_PERCENT}% · ${t(locale, 'test.result.threshold')}`);
</script>

<div
  class="chart"
  bind:clientWidth={width}
  role="img"
  aria-label={`${tf(locale, 'test.result.chart', { n: percents.length })}: ${percents.map((p) => `${p}%`).join(', ')}. ${passLabel}`}
>
  {#if width > 0}
    <svg {width} height={H} aria-hidden="true">
      <rect x="0" y={y(100)} {width} height={y(PASS_PERCENT) - y(100)} rx="6" class="zone" />
      <line x1="0" x2={width} y1={y(PASS_PERCENT)} y2={y(PASS_PERCENT)} class="pass" />
      <text x="18" y={y(PASS_PERCENT) - 6} class="pass-label">{passLabel}</text>
      <polyline {points} class="line" />
      {#each percents as p, i (i)}
        {#if i === last}
          <circle cx={x(i)} cy={y(p)} r="5.5" class="dot dot--last" />
          <text x={x(i) + 8} y={y(p) + 4} class="value">{p}%</text>
        {:else}
          <circle cx={x(i)} cy={y(p)} r="3.5" class="dot" />
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .chart {
    height: 120px;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .zone {
    fill: var(--success-bg);
  }
  .pass {
    stroke: var(--success);
    stroke-opacity: 0.95;
    stroke-width: 1.75;
    stroke-dasharray: 4 3;
  }
  .pass-label {
    font-size: 10px;
    font-weight: 800;
    fill: var(--success);
    font-variant-numeric: tabular-nums;
  }
  .line {
    fill: none;
    stroke: var(--bok-500);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .dot {
    fill: var(--white);
    stroke: var(--bok-500);
    stroke-width: 2;
  }
  .dot--last {
    fill: var(--bok-500);
    stroke: var(--white);
  }
  .value {
    font-size: 11px;
    font-weight: var(--fw-bold);
    fill: var(--ink-800);
    font-variant-numeric: tabular-nums;
  }
</style>
