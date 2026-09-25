<script lang="ts">
  import type { AppState } from '$lib/state/app.svelte';
  import type { DraftState } from '$lib/state/draft.svelte';
  import { OBSTACLES_URL, parseFeatures, LoadError } from '$lib/data/loader';
  import { diffFeatures } from '$lib/design/draftDiff';
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
          ...(app.dataLogo ? { logo: app.dataLogo } : {}),
          features: app.features
        }
      : null
  );

  const isLocalDraft = $derived(!!draft?.hasStoredDraft);

  const dialogData = $derived(
    draft
      ? {
          type: 'FeatureCollection' as const,
          club: draft.club,
          version: draft.version,
          ...(draft.logo ? { logo: draft.logo } : {}),
          features: draft.features
        }
      : liveCollection
  );

  const courseLabel = $derived(
    draft
      ? `${draft.club} · v${draft.version}`
      : liveCollection
        ? `${liveCollection.club} · v${liveCollection.version}`
        : null
  );

  function openDialog() {
    if (dialogData) open = true;
  }

  function openDiscard() {
    if (liveCollection) discardOpen = true;
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
        draft.replaceWith(parsed);
        app.bumpDataEpoch();
      } catch (err) {
        toast.error(err instanceof LoadError ? err.message : 'Invalid file');
      }
      return;
    }
    onImport(text);
  }
</script>

{#if courseLabel}
  <div class="flex min-w-0 items-start">
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="h-auto min-w-0 flex-1 flex-col items-start gap-0 rounded-sm px-1.5 py-0 leading-tight -ml-1.5"
      onclick={openDialog}
      title={isLocalDraft && draft && !draft.isValid ? (draft.validationErrors ?? undefined) : undefined}
    >
      <span class="w-full truncate text-left text-sm text-primary">{courseLabel}</span>
      {#if isLocalDraft && draft}
        <span
          class="w-full truncate text-left text-xs font-normal {draft.isValid
            ? 'text-muted-foreground'
            : 'text-destructive'}"
        >
          {draft.isValid ? t(app.locale, 'draft.status.saved') : t(app.locale, 'draft.status.invalid')}
        </span>
      {/if}
    </Button>

    {#if isLocalDraft && draft}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="rounded-sm"
                aria-label={t(app.locale, 'draft.discard')}
                onclick={(event: MouseEvent) => {
                  if (typeof props.onclick === 'function') props.onclick(event);
                  openDiscard();
                }}
              >
                <Trash2Icon />
              </Button>
            {/snippet}
          </TooltipTrigger>
          <TooltipContent side="top">{t(app.locale, 'draft.discard')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    {/if}
  </div>
{/if}

{#if draft && liveCollection}
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

{#if open && dialogData}
  <MapDataDialog
    locale={app.locale}
    data={dialogData}
    sourceUrl={isLocalDraft ? undefined : OBSTACLES_URL}
    validationErrors={draft?.validationErrors}
    isDraft={isLocalDraft}
    changes={isLocalDraft && liveCollection
      ? diffFeatures(liveCollection.features, draft!.features)
      : undefined}
    onDownload={draft ? handleDownload : undefined}
    onImport={handleImport}
    onRevertDraft={isLocalDraft && liveCollection ? openDiscard : undefined}
    onClose={() => (open = false)}
  />
{/if}
