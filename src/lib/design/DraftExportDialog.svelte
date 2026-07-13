<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import { parseFeatures, LoadError } from '$lib/data/loader';
  import type { DraftState } from '$lib/state/draft.svelte';
  import DatabaseIcon from '@lucide/svelte/icons/database';
  import XIcon from '@lucide/svelte/icons/x';
  import { toast } from 'svelte-sonner';

  let {
    draft,
    locale,
    onClose
  }: {
    draft: DraftState;
    locale: Locale;
    onClose: () => void;
  } = $props();

  let fileInput: HTMLInputElement;

  function handleDownload() {
    const data = draft.exportCollection();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obstacles-${data.version}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = await parseFeatures(text);
      draft.discard(parsed);
    } catch (err) {
      toast.error(err instanceof LoadError ? err.message : 'Invalid file');
    }
    (e.target as HTMLInputElement).value = '';
    onClose();
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }
</script>

<div
  class="fixed inset-0 z-[1700] flex items-center justify-center bg-black/60 p-5"
  role="presentation"
  onclick={onClose}
  use:portal
>
  <div
    class="flex w-[min(92vw,380px)] flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <DatabaseIcon class="size-5 text-muted-foreground" />
        <p class="text-base font-semibold text-foreground">{t(locale, 'settings.mapdata')}</p>
      </div>
      <Button variant="ghost" size="icon" class="size-7 shrink-0" onclick={onClose}>
        <XIcon class="size-4" />
      </Button>
    </div>

    {#if draft.validationErrors}
      <p class="text-xs text-destructive break-words">{draft.validationErrors}</p>
    {/if}

    <div class="flex flex-col gap-2">
      <Button variant="outline" class="w-full" onclick={handleDownload}>
        {t(locale, 'draft.export.download')}
      </Button>
      <Button variant="outline" class="w-full" onclick={() => fileInput.click()}>
        {t(locale, 'draft.export.import')}
      </Button>
    </div>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept=".geojson,application/geo+json,application/json"
    class="hidden"
    onchange={handleFileChange}
  />
</div>
