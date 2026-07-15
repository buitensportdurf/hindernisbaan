<script lang="ts">
  import { onMount } from 'svelte';
  import { t, type Locale } from '$lib/i18n';
  import { focusById } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';

  let {
    locale,
    error,
    onRetry,
    onImport
  }: {
    locale: Locale;
    error: string;
    onRetry: () => void;
    onImport: (text: string) => void;
  } = $props();

  let fileInput: HTMLInputElement;

  onMount(() => {
    focusById('load-fail-retry');
  });

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    onImport(text);
    (e.target as HTMLInputElement).value = '';
  }
</script>

<div
  class="fixed inset-0 z-[1600] flex items-center justify-center bg-black/60 p-5"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="load-fail-title"
>
  <div
    class="flex w-[min(92vw,380px)] flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-xl"
  >
    <div class="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
      <AlertCircleIcon class="size-6 text-destructive" />
    </div>

    <div>
      <p id="load-fail-title" class="text-base font-semibold text-foreground">
        {t(locale, 'load.title')}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">{error}</p>
    </div>

    <div class="flex w-full flex-col gap-2">
      <Button id="load-fail-retry" onclick={onRetry} class="w-full">{t(locale, 'load.retry')}</Button>
      <Button variant="outline" class="w-full" onclick={() => fileInput.click()}>
        {t(locale, 'load.import')}
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
