<script lang="ts">
  import type { AppState } from '$lib/state/app.svelte';
  import type { DraftState } from '$lib/state/draft.svelte';
  import { OBSTACLES_URL, parseFeatures, LoadError } from '$lib/data/loader';
  import { Button } from '$lib/components/ui/button';
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
  } from '$lib/components/ui/tooltip';
  import DiscardDraftDialog from '$lib/design/DiscardDraftDialog.svelte';
  import MapDataDialog from './MapDataDialog.svelte';
  import { t } from '$lib/i18n';
  import { toast } from 'svelte-sonner';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  let {
    app,
    onImport,
    draft = undefined
  }: {
    app: AppState;
    onImport: (text: string) => void;
    draft?: DraftState;
  } = $props();

  let open = $state(false);
  let discardOpen = $state(false);

  const liveCollection = $derived(
    app.dataClub !== null && app.dataVersion !== null
      ? {
          type: 'FeatureCollection' as const,
          club: app.dataClub,
          version: app.dataVersion,
          features: app.features
        }
      : null
  );

  const dialogData = $derived(
    draft
      ? {
          type: 'FeatureCollection' as const,
          club: draft.club,
          version: draft.version,
          features: draft.features
        }
      : liveCollection
  );

  function openDialog() {
    if (dialogData) open = true;
  }

  function handleDownload() {
    if (!draft) return;
    const data = draft.exportCollection();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obstacles-${data.version}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(text: string) {
    if (draft) {
      try {
        const parsed = await parseFeatures(text);
        draft.discard(parsed);
      } catch (err) {
        toast.error(err instanceof LoadError ? err.message : 'Invalid file');
      }
      return;
    }
    onImport(text);
  }
</script>

{#if draft}
  <Button
    variant="link"
    class="h-auto w-full min-w-0 justify-start p-0 text-xs"
    onclick={openDialog}
  >
    <span class="truncate">{draft.club} · v{draft.version}</span>
  </Button>

  <div class="flex w-full min-w-0 items-center gap-1">
    <Button
      variant="link"
      class="h-auto min-w-0 flex-1 justify-start gap-1.5 p-0 text-xs"
      onclick={openDialog}
      title={draft.isValid ? undefined : (draft.validationErrors ?? undefined)}
    >
      <span
        class="size-1.5 shrink-0 rounded-full {draft.isValid ? 'bg-emerald-500' : 'bg-destructive'}"
        aria-hidden="true"
      ></span>
      <span class="truncate {draft.isValid ? 'text-muted-foreground' : 'font-medium text-destructive'}">
        {draft.isValid ? t(app.locale, 'draft.status.saved') : t(app.locale, 'draft.status.invalid')}
      </span>
    </Button>

    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger>
          {#snippet child({ props })}
            <Button
              variant="ghost"
              size="icon"
              class="size-6 shrink-0 text-muted-foreground"
              onclick={() => (discardOpen = true)}
              {...props}
            >
              <Trash2Icon class="size-3.5" />
            </Button>
          {/snippet}
        </TooltipTrigger>
        <TooltipContent side="top">{t(app.locale, 'draft.discard')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>

  {#if liveCollection}
    <DiscardDraftDialog
      bind:open={discardOpen}
      locale={app.locale}
      onConfirm={() => {
        draft.discard(liveCollection);
        discardOpen = false;
        open = false;
        toast.success(t(app.locale, 'draft.toast.discarded'));
      }}
    />
  {/if}
{:else if liveCollection}
  <Button
    variant="link"
    class="h-auto w-full min-w-0 justify-start p-0 text-xs"
    onclick={openDialog}
  >
    <span class="truncate">{liveCollection.club} · v{liveCollection.version}</span>
  </Button>
{/if}

{#if open && dialogData}
  <MapDataDialog
    locale={app.locale}
    data={dialogData}
    sourceUrl={draft ? undefined : OBSTACLES_URL}
    validationErrors={draft?.validationErrors}
    onDownload={draft ? handleDownload : undefined}
    onImport={handleImport}
    onRevertDraft={draft && liveCollection ? () => (discardOpen = true) : undefined}
    onClose={() => (open = false)}
  />
{/if}
