<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
  } from '$lib/components/ui/tooltip';
  import { t, type Locale } from '$lib/i18n';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import StickyNoteIcon from '@lucide/svelte/icons/sticky-note';

  let {
    variant = 'text',
    locale,
    onclick
  }: {
    variant?: 'text' | 'icon';
    locale: Locale;
    onclick: () => void;
  } = $props();

  const label = $derived(t(locale, 'design.editor.notes.add'));
</script>

{#if variant === 'icon'}
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            {onclick}
            {...props}
          >
            <StickyNoteIcon class="size-4" />
          </Button>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
{:else}
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="-ml-2 self-start text-muted-foreground hover:text-foreground"
    {onclick}
  >
    <PlusIcon class="size-3.5" />
    {label}
  </Button>
{/if}
