<script lang="ts">
  import { tick } from 'svelte';
  import { t, tf, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import { QUESTION_CLOCK_S, clampRunLength, type RunLength, runMinutes } from './quiz';
  import PointerIcon from '@lucide/svelte/icons/pointer';
  import TimerIcon from '@lucide/svelte/icons/timer';
  import Volume2Icon from '@lucide/svelte/icons/volume-2';
  import VolumeXIcon from '@lucide/svelte/icons/volume-x';
  import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
  import Minimize2Icon from '@lucide/svelte/icons/minimize-2';

  let {
    locale,
    runLength,
    lengths,
    loading,
    tooFew,
    hasHistory,
    soundOn,
    fsOk = false,
    fsOn = true,
    onLength,
    onToggleSound,
    onToggleFs,
    onStart,
    onHistory
  }: {
    locale: Locale;
    runLength: RunLength;
    lengths: RunLength[];
    loading: boolean;
    tooFew: boolean;
    hasHistory: boolean;
    soundOn: boolean;
    fsOk?: boolean;
    fsOn?: boolean;
    onLength: (n: RunLength) => void;
    onToggleSound: () => void;
    onToggleFs?: () => void;
    onStart: () => void;
    onHistory: () => void;
  } = $props();

  let countOpen = $state(false);
  let selectEl = $state<HTMLSelectElement | null>(null);
  const minutes = $derived(runMinutes(runLength));
  const questionParts = $derived(t(locale, 'test.intro.questions').split('{n}'));

  async function openCount() {
    countOpen = true;
    await tick();
    selectEl?.focus();
    try {
      selectEl?.showPicker();
    } catch {
      /* older browsers keep the inline field */
    }
  }

  function changeLength(event: Event) {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    onLength(clampRunLength(value));
    countOpen = false;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && countOpen) countOpen = false;
  }}
/>

<section class="sheet" aria-labelledby="intro-title">
  <div class="top">
    <div>
      <h1 id="intro-title" class="title">{t(locale, 'test.title')}</h1>
      <p class="sub">{t(locale, 'test.intro.sub')}</p>
    </div>
    <div class="tools">
      {#if fsOk}
        <Button
          variant="ghost"
          size="icon"
          class="size-10 shrink-0 text-muted-foreground"
          aria-label={t(locale, fsOn ? 'test.fs.off' : 'test.fs.on')}
          aria-pressed={!fsOn}
          onclick={onToggleFs}
        >
          {#if fsOn}<Maximize2Icon />{:else}<Minimize2Icon />{/if}
        </Button>
      {/if}
      <Button
        variant="ghost"
        size="icon"
        class="size-10 shrink-0 text-muted-foreground"
        aria-label={t(locale, soundOn ? 'test.sound.mute' : 'test.sound.unmute')}
        aria-pressed={!soundOn}
        onclick={onToggleSound}
      >
        {#if soundOn}<Volume2Icon />{:else}<VolumeXIcon />{/if}
      </Button>
    </div>
  </div>

  <ul class="facts">
    <li>
      <PointerIcon />
      <span class="fact">
        {questionParts[0]}{#if countOpen}
          {#key lengths.join(',')}
            <select
              bind:this={selectEl}
              id="run-length"
              class={cn(
                'count-select h-7 rounded-md border border-input bg-background px-1.5 text-sm text-foreground shadow-sm',
                'tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              value={String(runLength)}
              aria-label={t(locale, 'test.intro.count')}
              onchange={changeLength}
            >
              {#each lengths as n (n)}
                <option value={String(n)}>{n}</option>
              {/each}
            </select>
          {/key}
        {:else}
          <button
            type="button"
            class="count"
            aria-label={t(locale, 'test.intro.count')}
            aria-haspopup="listbox"
            aria-expanded="false"
            onclick={openCount}
          >{runLength}</button>
        {/if}{questionParts[1] ?? ''}
      </span>
    </li>
    <li>
      <TimerIcon />{tf(locale, 'test.intro.time', {
        min: minutes,
        lo: QUESTION_CLOCK_S.lo,
        hi: QUESTION_CLOCK_S.hi
      })}
    </li>
  </ul>

  {#if tooFew}
    <p class="note">{t(locale, 'test.intro.tooFew')}</p>
  {/if}

  <div class="actions">
    <Button class="w-full" disabled={loading || tooFew} onclick={onStart}>
      {loading ? t(locale, 'test.intro.loading') : t(locale, 'test.intro.start')}
    </Button>
    {#if hasHistory}
      <Button variant="outline" size="sm" class="w-full" onclick={onHistory}>
        {t(locale, 'test.intro.history')}
      </Button>
    {/if}
  </div>
</section>

<style>
  .sheet {
    padding: 24px 18px calc(22px + env(safe-area-inset-bottom, 0px));
    background: var(--white);
    border-radius: 26px 26px 0 0;
    box-shadow: var(--quiz-sheet-shadow);
    animation: sheet-up 280ms var(--ease-out) both;
  }
  @media (min-width: 640px) {
    .sheet {
      padding-bottom: 22px;
      border-radius: 26px;
      box-shadow: 0 10px 36px rgba(0, 0, 0, 0.16);
    }
  }
  .top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .tools {
    display: flex;
    flex: none;
    gap: 2px;
  }
  .title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    color: var(--ink-800);
  }
  .sub {
    margin-top: 4px;
    font-size: 15px;
    color: var(--ink-500);
  }

  .facts {
    display: grid;
    gap: 9px;
    margin: 18px 0 0;
  }
  .facts li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: var(--fw-medium);
    color: var(--ink-600);
  }
  .facts li > :global(svg) {
    width: 18px;
    height: 18px;
    flex: none;
    color: var(--bok-700);
  }
  .fact {
    line-height: 1.45;
  }

  .count {
    padding: 0;
    margin: 0;
    border: none;
    border-bottom: 1.5px dashed var(--bok-500);
    border-radius: 0;
    background: none;
    color: var(--bok-800);
    font: inherit;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
  }
  .count:focus-visible {
    outline: 2px solid var(--bok-700);
    outline-offset: 2px;
    border-radius: 3px;
  }
  :global(.count-select) {
    width: 3.5rem;
    margin: 0 0.15em;
    vertical-align: baseline;
  }

  .note {
    margin-top: 14px;
    font-size: 14px;
    color: var(--error);
  }

  .actions {
    display: grid;
    gap: 8px;
    margin-top: 20px;
  }

  @keyframes sheet-up {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet {
      animation: none;
    }
  }
</style>
