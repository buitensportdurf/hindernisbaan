<script lang="ts">
  import { tick } from 'svelte';
  import { t, tf, type Locale } from '$lib/i18n';
  import { cn } from '$lib/utils';
  import CheckButton from './CheckButton.svelte';
  import type { Outcome, Question } from './quiz';
  import CheckIcon from '@lucide/svelte/icons/check';
  import PointerIcon from '@lucide/svelte/icons/pointer';
  import TimerOffIcon from '@lucide/svelte/icons/timer-off';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    locale,
    question,
    targetName,
    isCombi,
    eyebrow,
    feedback,
    picked,
    outcome,
    streak,
    fraction,
    urgent,
    onPick,
    onCheck,
    onNext
  }: {
    locale: Locale;
    question: Question;
    targetName: string;
    isCombi: boolean;
    eyebrow: string;
    feedback: boolean;
    picked: string | null;
    outcome: Outcome | null;
    /** Streak after this answer; shown under "Goed zo!" from two in a row. */
    streak: number | null;
    fraction: number | null;
    urgent: boolean;
    onPick: (value: string) => void;
    onCheck: () => void;
    onNext: () => void;
  } = $props();

  let nextButton = $state<HTMLButtonElement | null>(null);

  const tone = $derived(!feedback ? null : outcome === 'correct' ? 'ok' : 'bad');
  const findParts = $derived(t(locale, 'test.q.find').split('{name}'));
  const memberNameParts = $derived(t(locale, 'test.q.member.name').split('{name}'));
  const memberFindParts = $derived(t(locale, 'test.q.member.find').split('{name}'));

  const title = $derived(
    outcome === 'correct'
      ? t(locale, 'test.fb.correct')
      : outcome === 'timeout'
        ? t(locale, 'test.fb.timeout')
        : t(locale, 'test.fb.wrong')
  );
  const sub = $derived.by(() => {
    if (outcome === 'correct') return streak !== null && streak >= 2 ? tf(locale, 'test.fb.streak', { n: streak }) : '';
    return tf(locale, question.type === 'name' ? 'test.fb.isName' : 'test.fb.isHere', { name: targetName });
  });

  function tileState(option: string): string {
    if (!feedback) return option === picked ? 'is-selected' : '';
    if (option === targetName) return 'is-good';
    if (option === picked) return 'is-wrong';
    return '';
  }

  // Keyboard and screen reader users land on the next step.
  $effect(() => {
    if (!feedback) return;
    void tick().then(() => nextButton?.focus({ preventScroll: true }));
  });
</script>

<section class={cn('sheet', tone && `sheet--${tone}`)} aria-label={eyebrow}>
  <div class="head">
    <div class="qhead" class:gone={feedback} aria-hidden={feedback}>
      <p class="eyebrow">{eyebrow}</p>
      {#if question.memberName && question.type === 'name'}
        <h2 class="prompt">{memberNameParts[0]}<b>{question.memberName}</b>{memberNameParts[1] ?? ''}</h2>
      {:else if question.memberName}
        <h2 class="prompt">{memberFindParts[0]}<b>{question.memberName}</b>{memberFindParts[1] ?? ''}</h2>
        <p class="hint">
          <PointerIcon />
          {t(locale, picked ? 'test.q.find.picked' : 'test.q.find.hint')}
        </p>
      {:else if question.type === 'name'}
        <h2 class="prompt">
          {t(locale, isCombi ? 'test.q.name.combi' : 'test.q.name.obstacle')}
        </h2>
      {:else}
        <h2 class="prompt">{findParts[0]}<b>{targetName}</b>{findParts[1] ?? ''}</h2>
        <p class="hint">
          <PointerIcon />
          {t(locale, picked ? 'test.q.find.picked' : 'test.q.find.hint')}
        </p>
      {/if}
    </div>

    <div class={cn('fhead', tone && `fhead--${tone}`)} class:shown={feedback} aria-live="polite">
      {#if feedback}
        <span class="badge">
          {#if outcome === 'correct'}<CheckIcon />{:else if outcome === 'timeout'}<TimerOffIcon />{:else}<XIcon />{/if}
        </span>
        <div class="fbtext">
          <p class="fbtitle">{title}</p>
          {#if sub}<p class="fbsub">{sub}</p>{/if}
        </div>
      {/if}
    </div>
  </div>

  {#if question.type === 'name'}
    <div class="grid">
      {#each question.options as option, i (option)}
        <button
          type="button"
          class={cn('quiz-tile', tileState(option))}
          data-quiz-tile
          aria-pressed={!feedback ? option === picked : undefined}
          aria-keyshortcuts={String(i + 1)}
          disabled={feedback}
          onclick={() => onPick(option)}
        >
          {option}
        </button>
      {/each}
    </div>
  {/if}

  <div class="action">
    {#if feedback}
      <button
        bind:this={nextButton}
        type="button"
        data-quiz-action
        class={cn('quiz-btn', tone === 'ok' ? 'quiz-btn--ok' : 'quiz-btn--bad')}
        onclick={onNext}
      >
        {t(locale, 'test.continue')}
      </button>
    {:else}
      <CheckButton
        label={t(locale, 'test.check')}
        enabled={picked !== null}
        {fraction}
        {urgent}
        onclick={onCheck}
      />
    {/if}
  </div>
</section>

<style>
  .sheet {
    padding: 22px 18px calc(22px + env(safe-area-inset-bottom, 0px));
    background: var(--white);
    border-radius: 26px 26px 0 0;
    box-shadow: var(--quiz-sheet-shadow);
    transition: background-color 120ms ease-out;
  }
  @media (min-width: 640px) {
    .sheet {
      padding-bottom: 22px;
      border-radius: 26px;
      box-shadow: 0 10px 36px rgba(0, 0, 0, 0.16);
    }
  }
  .sheet--ok {
    background: var(--success-bg);
  }
  .sheet--bad {
    background: var(--error-bg);
  }

  .head {
    display: grid;
    margin-bottom: 16px;
  }
  .qhead,
  .fhead {
    grid-area: 1 / 1;
    min-width: 0;
  }
  .qhead {
    transition: opacity 90ms ease-out, transform 110ms var(--ease-out);
  }
  .qhead.gone {
    opacity: 0;
    transform: translateY(-6px);
    pointer-events: none;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: var(--fw-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gray-500);
  }
  .prompt {
    margin-top: 6px;
    font-size: 22px;
    font-weight: var(--fw-bold);
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: var(--ink-800);
    text-wrap: balance;
  }
  .prompt b {
    color: var(--bok-800);
  }
  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 14px;
    color: var(--ink-500);
  }
  .hint :global(svg) {
    width: 16px;
    height: 16px;
    flex: none;
  }

  .fhead {
    display: flex;
    align-items: center;
    gap: 12px;
    align-self: center;
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 100ms ease-out, transform 140ms var(--ease-out);
    pointer-events: none;
  }
  .fhead.shown {
    opacity: 1;
    transform: none;
  }
  .fhead--ok {
    color: var(--success);
  }
  .fhead--bad {
    color: var(--error);
  }
  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: 50%;
    background: var(--white);
  }
  .badge :global(svg) {
    width: 20px;
    height: 20px;
    stroke-width: 3;
  }
  .fhead.shown .badge {
    animation: badge-in 380ms var(--ease-bounce) 60ms both;
  }
  .fbtext {
    min-width: 0;
  }
  .fbtitle {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .fbsub {
    margin-top: 2px;
    font-size: 14px;
    font-weight: var(--fw-semibold);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .action {
    margin-top: 16px;
  }

  @keyframes badge-in {
    0% { transform: scale(0.4); }
    100% { transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .qhead,
    .fhead {
      transition: opacity 120ms linear;
      transform: none;
    }
    .fhead.shown .badge {
      animation: none;
    }
  }
</style>
