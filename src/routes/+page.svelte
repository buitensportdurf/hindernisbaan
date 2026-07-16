<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import LsBlockDialog from '$lib/components/LsBlockDialog.svelte';
  import MapFeatureSheet from '$lib/map/MapFeatureSheet.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { isLocalStorageAvailable, readKey } from '$lib/storage/local';
  import { resolveInitialLocale, LANG_KEY } from '$lib/i18n';

  function lsblockPreview(): boolean {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('lsblock');
  }

  let storageOk = $state(!lsblockPreview());

  const locale = resolveInitialLocale(
    typeof localStorage !== 'undefined' ? readKey(LANG_KEY) : null,
    typeof navigator !== 'undefined' ? navigator.language : undefined
  );

  const app = createAppState();
  let detailsOpen = $state(false);

  const selectedFeature = $derived(
    app.features.find((f) => f.id === app.selectedId) ?? null
  );

  function closeDetails() {
    app.selectFeature(null);
  }

  $effect(() => {
    if (app.selectedId === null) {
      detailsOpen = false;
    } else {
      detailsOpen = true;
    }
  });

  onMount(() => {
    storageOk = lsblockPreview() ? false : isLocalStorageAvailable();
  });
</script>

{#if !storageOk}
  <LsBlockDialog {locale} />
{:else}
  <AppShell {app}>
    {#snippet editorPanel()}
      <MapFeatureSheet
        bind:open={detailsOpen}
        feature={selectedFeature}
        onClose={closeDetails}
        locale={app.locale}
      />
    {/snippet}
  </AppShell>
{/if}
