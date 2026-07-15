<script lang="ts">
  import { onMount } from 'svelte';
  import { t, type Locale } from '$lib/i18n';
  import { focusById } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import type { FeatureCollection } from '$lib/data/types';
  import DatabaseIcon from '@lucide/svelte/icons/database';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    locale,
    data,
    sourceUrl,
    validationErrors = null,
    onDownload,
    onImport,
    onRevertDraft,
    onClose
  }: {
    locale: Locale;
    data: FeatureCollection;
    sourceUrl?: string;
    validationErrors?: string | null;
    onDownload?: () => void;
    onImport: (text: string) => void;
    onRevertDraft?: () => void;
    onClose: () => void;
  } = $props();

  let fileInput: HTMLInputElement;

  onMount(() => {
    const previouslyFocused = document.activeElement;
    focusById('mapdata-dialog-close');
    return () => {
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  });

  function handleDownload() {
    if (onDownload) {
      onDownload();
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/geo+json'
    });
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
    onImport(text);
    (e.target as HTMLInputElement).value = '';
    onClose();
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
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
    aria-labelledby="mapdata-dialog-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => {
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
    }}
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <DatabaseIcon class="size-5 text-muted-foreground" />
        <p id="mapdata-dialog-title" class="text-base font-semibold text-foreground">
          {t(locale, 'settings.mapdata')}
        </p>
      </div>
      <Button
        id="mapdata-dialog-close"
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        aria-label={t(locale, 'mapdata.close')}
        onclick={onClose}
      >
        <XIcon class="size-4" />
      </Button>
    </div>

    <dl class="flex flex-col gap-1.5 text-sm">
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'mapdata.club')}</dt>
        <dd class="font-medium text-foreground">{data.club}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'settings.mapdata.created')}</dt>
        <dd class="font-medium text-foreground">{data.version}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'settings.mapdata.count')}</dt>
        <dd class="font-medium text-foreground">{data.features.length}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted-foreground">{t(locale, 'mapdata.source')}</dt>
        <dd class="truncate font-medium text-foreground">
          {sourceUrl ?? t(locale, 'mapdata.source.draft')}
        </dd>
      </div>
    </dl>

    {#if validationErrors}
      <p class="break-words text-xs text-destructive">{validationErrors}</p>
    {/if}

    {#if onRevertDraft}
      <Button variant="destructive" class="w-full" onclick={onRevertDraft}>
        {t(locale, 'draft.discard')}
      </Button>
    {/if}

    <div class="flex flex-col gap-2">
      <Button variant="outline" class="w-full" onclick={handleDownload}>
        {t(locale, 'mapdata.download')}
      </Button>
      <Button variant="outline" class="w-full" onclick={() => fileInput.click()}>
        {t(locale, 'mapdata.import')}
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
