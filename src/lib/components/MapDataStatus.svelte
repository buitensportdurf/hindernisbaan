<script lang="ts">
  import type { AppState } from '$lib/state/app.svelte';
  import { OBSTACLES_URL } from '$lib/data/loader';
  import { Button } from '$lib/components/ui/button';
  import MapDataDialog from './MapDataDialog.svelte';

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
  <Button
    variant="link"
    class="group h-auto w-full min-w-0 justify-start p-0 text-xs no-underline hover:no-underline"
    onclick={() => (open = true)}
  >
    <span class="truncate group-hover:underline">{club} · v{version}</span>
  </Button>

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
