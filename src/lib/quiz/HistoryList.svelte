<script lang="ts">
  import { tf, type Locale } from '$lib/i18n';
  import ProgressChart from './ProgressChart.svelte';
  import { binName, formatRunDate } from './bins';
  import { binIndex, isPass, percentOf } from './quiz';
  import type { RunRecord } from './runs';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

  let {
    locale,
    runs,
    onOpen
  }: {
    locale: Locale;
    /** Oldest first. */
    runs: RunRecord[];
    onOpen: (run: RunRecord) => void;
  } = $props();

  const newestFirst = $derived([...runs].reverse());
  const chart = $derived(runs.length >= 3 ? runs.slice(-8).map((r) => percentOf(r.correct, r.total)) : null);
</script>

{#if chart}
  <div class="chart">
    <ProgressChart {locale} percents={chart} />
  </div>
{/if}

<ul>
  {#each newestFirst as run (run.id)}
    {@const pct = percentOf(run.correct, run.total)}
    <li>
      <button type="button" class="row" onclick={() => onOpen(run)}>
        <span class="when">{formatRunDate(locale, run.startedAt)}</span>
        <span class="chip" class:pass={isPass(pct)}>{binName(locale, binIndex(pct))}</span>
        <span class="pct">{pct}%</span>
        <span class="sr-only">{tf(locale, 'test.result.score', { correct: run.correct, total: run.total })}</span>
        <ChevronRightIcon />
      </button>
    </li>
  {/each}
</ul>

<style>
  .chart {
    margin: 10px 0 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 4px;
    border-bottom: 1px solid var(--gray-100);
    text-align: left;
    color: var(--ink-800);
  }
  .row:hover {
    background: var(--gray-50);
  }
  .row:focus-visible {
    outline: 2px solid var(--bok-700);
    outline-offset: -2px;
    border-radius: 8px;
  }
  .row :global(svg) {
    width: 18px;
    height: 18px;
    flex: none;
    color: var(--gray-400);
  }
  .when {
    flex: 1;
    font-size: 14px;
    color: var(--ink-600);
    font-variant-numeric: tabular-nums;
  }
  .chip {
    padding: 3px 9px;
    border-radius: 99px;
    background: var(--sand-100);
    color: var(--sand-700);
    font-size: 12px;
    font-weight: var(--fw-bold);
    white-space: nowrap;
  }
  .chip.pass {
    background: var(--success-bg);
    color: var(--success);
  }
  .pct {
    width: 42px;
    text-align: right;
    font-size: 15px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
</style>
