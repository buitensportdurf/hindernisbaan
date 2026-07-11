<script lang="ts">
  import type { AppState } from '$lib/state/app.svelte';
  import { OBSTACLES_URL } from '$lib/data/loader';
  import MapDataDialog from './MapDataDialog.svelte';
  import DatabaseIcon from '@lucide/svelte/icons/database';

  let {
    app,
    onImport
  }: {
    app: AppState;
    onImport: (text: string) => void;
  } = $props();

  let open = $state(false);
</script>

{#if app.dataClub !== null && app.dataVersion !== null}
  {@const club = app.dataClub}
  {@const version = app.dataVersion}
  <button
    type="button"
    class="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    onclick={() => (open = true)}
  >
    <DatabaseIcon class="size-3 shrink-0" />
    <span class="truncate">{club} · v{version}</span>
  </button>

  {#if open}
    <MapDataDialog
      locale={app.locale}
      data={{
        type: 'FeatureCollection',
        club,
        version,
        features: app.features
      }}
      sourceUrl={OBSTACLES_URL}
      {onImport}
      onClose={() => (open = false)}
    />
  {/if}
{/if}
