<script lang="ts">
  import { t, LOCALES } from '$lib/i18n';
  import type { TileKey } from '$lib/map/tiles';
  import type { AppState } from '$lib/state/app.svelte';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import { Card, CardDescription, CardTitle } from '$lib/components/ui/card';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import LanguagesIcon from '@lucide/svelte/icons/languages';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import MapIcon from '@lucide/svelte/icons/map';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import SatelliteIcon from '@lucide/svelte/icons/satellite';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import XIcon from '@lucide/svelte/icons/x';

  let { app }: { app: AppState } = $props();

  const PANEL_MS = 220;
  let panelMounted = $state(false);
  let panelOpen = $state(false);

  $effect(() => {
    if (app.menuOpen) {
      panelMounted = true;
      const frame = requestAnimationFrame(() => {
        panelOpen = true;
      });
      return () => cancelAnimationFrame(frame);
    }

    panelOpen = false;
    const timeout = setTimeout(() => {
      panelMounted = false;
    }, PANEL_MS);
    return () => clearTimeout(timeout);
  });

  const menuButton =
    'h-auto w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-semibold';
  const languageButton =
    'h-7 min-h-7 w-9 rounded-md px-0 py-0 text-xs font-semibold uppercase';
  const sectionLabel =
    'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground';
  const menuIcon = 'size-4 shrink-0 text-muted-foreground';

  const flushCard =
    'max-h-[78vh] w-[min(86vw,300px)] gap-0 overflow-x-hidden overflow-y-auto rounded-none rounded-br-xl border-0 py-0 shadow-[4px_4px_16px_rgba(0,0,0,0.08)] ring-0';

  let measureEl = $state<HTMLDivElement | null>(null);
  let bodyHeight = $state<number | null>(null);
  let bodyReady = $state(false);

  $effect(() => {
    const el = measureEl;
    if (!el) return;

    const sync = () => {
      bodyHeight = Math.ceil(el.getBoundingClientRect().height);
      bodyReady = true;
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (!panelMounted) {
      bodyHeight = null;
      bodyReady = false;
    }
  });
</script>

{#if panelMounted}
  <div
    class={cn('menu-backdrop fixed inset-0 z-[1150] bg-black/5', panelOpen && 'menu-backdrop--open')}
    role="presentation"
    onclick={() => app.closeMenu()}
  ></div>
{/if}

<div class="absolute left-0 top-0 z-[1250]">
  {#if panelMounted}
    <Card
      size="sm"
      class={cn(flushCard, 'menu-panel', panelOpen && 'menu-panel--open')}
      role="menu"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div
        class={cn('menu-body-shell', bodyReady && 'menu-body-shell--ready')}
        style:height={bodyHeight === null ? undefined : `${bodyHeight}px`}
      >
        <div bind:this={measureEl}>
          <header class="flex items-center gap-3 p-3 pb-2">
            <Button
              variant="outline"
              size="icon"
              class="shrink-0"
              aria-label={t(app.locale, 'menu.settings')}
              onclick={() => app.toggleMenu()}
            >
              {#if app.menuLevel === 'settings'}
                <ArrowLeftIcon />
              {:else}
                <XIcon />
              {/if}
            </Button>

            <div class="flex min-h-9 min-w-0 flex-1 flex-col justify-center gap-0">
              {#if app.menuLevel === 'root'}
                <CardTitle class="text-lg font-semibold leading-tight tracking-tight">
                  {t(app.locale, 'app.title')}
                </CardTitle>
                <CardDescription class="text-xs leading-snug">
                  {t(app.locale, 'app.subtitle')} · v2026.juni
                </CardDescription>
              {:else}
                <CardTitle class="text-lg font-semibold leading-tight tracking-tight">
                  {t(app.locale, 'settings.title')}
                </CardTitle>
              {/if}
            </div>
          </header>

          <div class="flex flex-col gap-5 px-3 pb-4 pt-1">
        {#if app.menuLevel === 'root'}
          <Button variant="ghost" class={menuButton} onclick={() => app.gotoSettings()}>
            <SettingsIcon class={menuIcon} />
            <span class="flex-1 text-left">{t(app.locale, 'menu.settings')}</span>
            <ChevronRightIcon class="text-muted-foreground" />
          </Button>
        {:else}
          <section class="flex flex-col gap-2">
            <p class={sectionLabel}>
              <LayersIcon class="size-3" />
              {t(app.locale, 'settings.tiles')}
            </p>
            <div class="flex flex-col gap-1">
              {#each ['map', 'sat'] as key (key)}
                <Button
                  variant="ghost"
                  class={cn(
                    menuButton,
                    app.tile === key && 'bg-secondary text-secondary-foreground'
                  )}
                  onclick={() => app.setTile(key as TileKey)}
                >
                  {#if key === 'map'}
                    <MapIcon class={menuIcon} />
                  {:else}
                    <SatelliteIcon class={menuIcon} />
                  {/if}
                  <span class="flex-1 text-left">
                    {t(app.locale, key === 'map' ? 'settings.tiles.map' : 'settings.tiles.sat')}
                    <span class="font-medium text-muted-foreground">
                      {key === 'map' ? ' - ' : ' · '}{t(
                        app.locale,
                        key === 'map' ? 'settings.tiles.map.sub' : 'settings.tiles.sat.sub'
                      )}
                    </span>
                  </span>
                </Button>
              {/each}
            </div>
          </section>

          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              <LanguagesIcon class="size-3" />
              {t(app.locale, 'settings.language')}
            </p>
            <div class="flex w-fit gap-1">
              {#each LOCALES as l (l)}
                <Button
                  variant="ghost"
                  class={cn(
                    languageButton,
                    app.locale === l && 'bg-secondary text-secondary-foreground'
                  )}
                  onclick={() => app.setLocale(l)}
                >
                  {l}
                </Button>
              {/each}
            </div>
          </section>
        {/if}
          </div>
        </div>
      </div>
    </Card>
  {:else}
    <div class="p-3">
      <Button
        variant="outline"
        size="icon"
        aria-label={t(app.locale, 'menu.settings')}
        onclick={() => app.toggleMenu()}
      >
        <MenuIcon />
      </Button>
    </div>
  {/if}
</div>
