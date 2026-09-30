<script lang="ts">
  import { t, tf, type Locale } from '$lib/i18n';
  import type { TKey } from '$lib/i18n/dict';
  import type { AnswerRecord, RunRecord } from './runs';
  import CheckIcon from '@lucide/svelte/icons/check';
  import TimerOffIcon from '@lucide/svelte/icons/timer-off';
  import XIcon from '@lucide/svelte/icons/x';

  let { locale, run }: { locale: Locale; run: RunRecord } = $props();

  const tiers = $derived.by(() => {
    const groups = new Map<number, AnswerRecord[]>();
    for (const a of run.answers) groups.set(a.tier, [...(groups.get(a.tier) ?? []), a]);
    return [...groups.entries()].sort(([a], [b]) => a - b);
  });

  function detail(a: AnswerRecord): string {
    if (a.outcome === 'timeout') return t(locale, 'test.report.timeout');
    if (a.outcome === 'correct' || !a.picked) return '';
    return a.type === 'name'
      ? tf(locale, 'test.report.you', { name: a.picked })
      : tf(locale, 'test.report.youFind', { name: a.pickedName ?? '?' });
  }
</script>

{#each tiers as [tier, answers] (tier)}
  <section class="tier">
    <h3 class="label">{t(locale, `test.tier.${tier}` as TKey)}</h3>
    <ul>
      {#each answers as a, i (i)}
        {@const more = detail(a)}
        <li class="row">
          <span class="mark mark--{a.outcome}">
            {#if a.outcome === 'correct'}<CheckIcon />{:else if a.outcome === 'timeout'}<TimerOffIcon />{:else}<XIcon />{/if}
          </span>
          <div class="text">
            <p class="name">{a.memberName ?? a.name}</p>
            <p class="meta">
              {#if a.memberName}{tf(locale, 'test.report.memberOf', { combi: a.name })} · {/if}{t(
                locale,
                a.type === 'name' ? 'test.report.name' : 'test.report.find'
              )}{#if more}<span class:bad={a.outcome === 'wrong'}>{` · ${more}`}</span>{/if}
            </p>
          </div>
          <span class="secs">
            {a.outcome === 'timeout' ? '—' : tf(locale, 'test.report.seconds', { n: Math.max(1, Math.round(a.ms / 1000)) })}
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .tier + .tier {
    margin-top: 18px;
  }
  .label {
    margin: 10px 0 4px;
    font-size: 11px;
    font-weight: var(--fw-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gray-500);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--gray-100);
  }
  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex: none;
    border-radius: 50%;
  }
  .mark :global(svg) {
    width: 15px;
    height: 15px;
    stroke-width: 3;
  }
  .mark--correct {
    background: var(--success-bg);
    color: var(--success);
  }
  .mark--wrong {
    background: var(--error-bg);
    color: var(--error);
  }
  .mark--timeout {
    background: var(--warning-bg);
    color: var(--warning);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 15px;
    font-weight: var(--fw-semibold);
    line-height: 1.25;
  }
  .meta {
    margin-top: 1px;
    font-size: 12px;
    color: var(--ink-500);
  }
  .meta .bad {
    color: var(--error);
  }
  .secs {
    flex: none;
    font-size: 13px;
    font-weight: var(--fw-semibold);
    color: var(--gray-500);
    font-variant-numeric: tabular-nums;
  }
</style>
