<script lang="ts">
  import { tf, type Locale } from '$lib/i18n';
  import ProgressChart from './ProgressChart.svelte';
  import BinTerm from './BinTerm.svelte';
  import { formatRunDate } from './bins';
  import { isPass, percentOf } from './quiz';
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
      <div class="row">
        <button type="button" class="when" onclick={() => onOpen(run)}>
          {formatRunDate(locale, run.startedAt)}
          <span class="sr-only">{tf(locale, 'test.result.score', { correct: run.correct, total: run.total })}</span>
        </button>
        <BinTerm {locale} correct={run.correct} total={run.total} class={`chip${isPass(pct) ? ' pass' : ''}`} />
        <button type="button" class="rest" onclick={() => onOpen(run)}>
          <span class="pct">{pct}%</span>
          <ChevronRightIcon />
        </button>
      </div>
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
    color: var(--ink-800);
  }
  .row:hover {
    background: var(--gray-50);
  }
  .when,
  .rest {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: 0;
    text-align: left;
    color: inherit;
  }
  .when {
    flex: 1;
    font-size: 14px;
    color: var(--ink-600);
    font-variant-numeric: tabular-nums;
  }
  .when:focus-visible,
  .rest:focus-visible {
    outline: 2px solid var(--bok-700);
    outline-offset: 2px;
    border-radius: 8px;
  }
  .rest :global(svg) {
    width: 18px;
    height: 18px;
    flex: none;
    color: var(--gray-400);
  }
  .row :global(.chip) {
    padding: 3px 9px;
    border-radius: 99px;
    background: var(--sand-100);
    color: var(--sand-700);
    font-size: 12px;
    font-weight: var(--fw-bold);
    white-space: nowrap;
  }
  .row :global(.chip.pass) {
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
