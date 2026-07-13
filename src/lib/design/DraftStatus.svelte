<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import DiscardDraftDialog from './DiscardDraftDialog.svelte';
  import DraftExportDialog from './DraftExportDialog.svelte';
  import { t, type Locale } from '$lib/i18n';
  import type { DraftState } from '$lib/state/draft.svelte';
  import type { FeatureCollection } from '$lib/data/types';
  import { toast } from 'svelte-sonner';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';

  let {
    draft,
    live,
    locale
  }: {
    draft: DraftState;
    live: FeatureCollection;
    locale: Locale;
  } = $props();

  let discardOpen = $state(false);
  let exportOpen = $state(false);
  let hovering = $state(false);
</script>

<div
  class="group/draft flex items-center justify-between gap-2 text-xs"
  role="group"
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <button
    type="button"
    class={draft.isValid ? 'text-muted-foreground' : 'font-medium text-destructive'}
    onclick={() => (exportOpen = true)}
    title={draft.isValid ? undefined : (draft.validationErrors ?? undefined)}
  >
    {#if !draft.isValid}
      <CircleAlertIcon class="mr-1 inline size-3.5 align-text-bottom" />
    {/if}
    {draft.isValid ? t(locale, 'draft.status.saved') : t(locale, 'draft.status.invalid')}
  </button>

  {#if hovering}
    <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={() => (discardOpen = true)}>
      {t(locale, 'draft.discard')}
    </Button>
  {/if}
</div>

<DiscardDraftDialog
  bind:open={discardOpen}
  {locale}
  onConfirm={() => {
    draft.discard(live);
    discardOpen = false;
    toast.success(t(locale, 'draft.toast.discarded'));
  }}
/>

{#if exportOpen}
  <DraftExportDialog {draft} {locale} onClose={() => (exportOpen = false)} />
{/if}
