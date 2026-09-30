<script lang="ts">
  import { t, tf, type Locale } from '$lib/i18n';
  import FlameIcon from '@lucide/svelte/icons/flame';
  import Volume2Icon from '@lucide/svelte/icons/volume-2';
  import VolumeXIcon from '@lucide/svelte/icons/volume-x';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    locale,
    segments,
    done,
    total,
    streak = null,
    soundOn,
    onToggleSound,
    onQuit,
    el = $bindable(null)
  }: {
    locale: Locale;
    /** Fill per segment, 0–1. One segment per tier; practice uses one. */
    segments: number[];
    done: number;
    total: number;
    /** Hidden when null (practice). */
    streak?: number | null;
    soundOn: boolean;
    onToggleSound: () => void;
    onQuit: () => void;
    el?: HTMLElement | null;
  } = $props();
</script>

<div class="rail" bind:this={el}>
  <button type="button" class="icon" aria-label={t(locale, 'test.quit')} onclick={onQuit}>
    <XIcon />
  </button>

  <div
    class="prog"
    role="progressbar"
    aria-label={tf(locale, 'test.progress', { n: done, total })}
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={done}
  >
    {#each segments as fill, i (i)}
      <span class="seg"><i style:width={`${fill * 100}%`}></i></span>
    {/each}
  </div>

  {#if streak !== null}
    <span class="streak" class:cold={streak === 0} aria-label={tf(locale, 'test.streak', { n: streak })}>
      <FlameIcon />
      {#key streak}
        <span class="n" class:bump={streak > 0}>{streak}</span>
      {/key}
    </span>
  {/if}

  <button
    type="button"
    class="icon"
    aria-label={t(locale, soundOn ? 'test.sound.mute' : 'test.sound.unmute')}
    aria-pressed={!soundOn}
    onclick={onToggleSound}
  >
    {#if soundOn}<Volume2Icon />{:else}<VolumeXIcon />{/if}
  </button>
</div>

<style>
  .rail {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 8px 0 6px;
    background: var(--white);
    border-radius: 16px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: 10px;
    color: #a3a3a3;
    transition: color 120ms ease-out, background-color 120ms ease-out;
  }
  .icon:hover {
    color: var(--ink-600);
    background: var(--gray-100);
  }
  .icon:focus-visible {
    outline: 2px solid var(--bok-700);
    outline-offset: 1px;
  }
  .icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .prog {
    flex: 1;
    display: flex;
    gap: 4px;
  }
  .seg {
    position: relative;
    flex: 1;
    height: 12px;
    border-radius: 6px;
    background: var(--quiz-off);
    overflow: hidden;
  }
  .seg i {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 6px;
    background: var(--bok-500);
    transition: width 420ms var(--ease-out);
  }
  .seg i::after {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    top: 3px;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.35);
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: 40px;
    color: var(--warning);
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .streak :global(svg) {
    width: 20px;
    height: 20px;
    fill: currentColor;
    transition: color 200ms ease-out;
  }
  .streak.cold {
    color: #c4c4c4;
  }
  .streak.cold :global(svg) {
    color: #d6d6d6;
  }
  .n.bump {
    display: inline-block;
    animation: bump 420ms var(--ease-bounce);
  }
  @keyframes bump {
    0% { transform: scale(1); }
    40% { transform: scale(1.45); }
    100% { transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .n.bump {
      animation: none;
    }
  }
</style>
