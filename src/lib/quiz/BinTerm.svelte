<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
  import { tf, type Locale } from '$lib/i18n';
  import BinRidge from './BinRidge.svelte';
  import { binName } from './bins';
  import { binIndex, percentOf } from './quiz';

  let {
    locale,
    correct,
    total,
    previous = null,
    class: className = '',
    children
  }: {
    locale: Locale;
    correct: number;
    total: number;
    previous?: number | null;
    class?: string;
    children?: Snippet;
  } = $props();

  const name = $derived(binName(locale, binIndex(percentOf(correct, total))));
</script>

<Popover>
  <PopoverTrigger>
    {#snippet child({ props })}
      <button
        type="button"
        class={className}
        aria-label={tf(locale, 'test.bin.showScale', { bin: name })}
        {...props}
        onclick={(e) => {
          e.stopPropagation();
          const fn = Reflect.get(props, 'onclick');
          if (typeof fn === 'function') fn(e);
        }}
      >
        {#if children}{@render children()}{:else}{name}{/if}
      </button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-[min(22rem,calc(100vw-24px))] p-3" align="center" collisionPadding={12}>
    <BinRidge {locale} {correct} {total} {previous} climb showCaption reducedMotion />
  </PopoverContent>
</Popover>
