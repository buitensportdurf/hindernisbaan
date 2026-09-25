<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import LsBlockDialog from '$lib/components/LsBlockDialog.svelte';
  import MapFeatureSheet from '$lib/map/MapFeatureSheet.svelte';
  import { createInteractionController } from '$lib/interaction/controller.svelte';
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
  const interaction = createInteractionController({
    openDetailsOn: 'click',
    isMenuOpen: () => app.menuOpen,
    closeMenu: () => app.closeMenu()
  });

  const selectedFeature = $derived(
    app.features.find((f) => f.id === interaction.selectedId) ?? null
  );

  onMount(() => {
    storageOk = lsblockPreview() ? false : isLocalStorageAvailable();
  });
</script>

{#if !storageOk}
  <LsBlockDialog {locale} />
{:else}
  <AppShell {app} {interaction}>
    {#snippet editorPanel()}
      <MapFeatureSheet
        open={interaction.detailsOpen}
        onOpenChange={(v) => {
          if (!v) interaction.closeDetails();
        }}
        feature={selectedFeature}
        onClose={() => interaction.closeDetails()}
        locale={app.locale}
      />
    {/snippet}
  </AppShell>
{/if}
