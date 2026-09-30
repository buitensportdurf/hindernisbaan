<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    title,
    closeLabel,
    back = false,
    onClose,
    header,
    children
  }: {
    title: string;
    closeLabel: string;
    /** Show a back arrow instead of a cross. */
    back?: boolean;
    onClose: () => void;
    header?: Snippet;
    children: Snippet;
  } = $props();

  let closeButton = $state<HTMLButtonElement | null>(null);
  onMount(() => closeButton?.focus({ preventScroll: true }));
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    onClose();
  }}
/>

<div class="scrim" role="presentation" onclick={onClose}></div>
<div class="panel" role="dialog" aria-modal="true" aria-label={title}>
  <header class="bar">
    <button bind:this={closeButton} type="button" class="close" aria-label={closeLabel} onclick={onClose}>
      {#if back}<ArrowLeftIcon />{:else}<XIcon />{/if}
    </button>
    <div class="heading">
      {#if header}{@render header()}{:else}<h2 class="title">{title}</h2>{/if}
    </div>
  </header>
  <div class="scroll">
    {@render children()}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 1400;
    background: rgba(0, 0, 0, 0.28);
    animation: fade 200ms ease-out both;
  }
  .panel {
    position: fixed;
    inset: 0;
    z-index: 1401;
    display: flex;
    flex-direction: column;
    background: var(--white);
    color: var(--ink-800);
    animation: rise 320ms var(--ease-out) both;
  }
  @media (min-width: 640px) {
    .panel {
      inset: 24px auto 24px 50%;
      width: 440px;
      margin-left: -220px;
      border-radius: 22px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);
      overflow: hidden;
    }
  }

  .bar {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 18px 12px 12px;
    border-bottom: 1px solid var(--gray-100);
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 12px;
    color: var(--ink-500);
  }
  .close:hover {
    background: var(--gray-100);
    color: var(--ink-800);
  }
  .close:focus-visible {
    outline: 2px solid var(--bok-700);
    outline-offset: 1px;
  }
  .close :global(svg) {
    width: 22px;
    height: 22px;
  }
  .heading {
    flex: 1;
    min-width: 0;
    padding-top: 6px;
  }
  .title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 6px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  }

  @keyframes rise {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel,
    .scrim {
      animation: none;
    }
  }
</style>
