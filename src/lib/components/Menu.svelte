<script lang="ts">
  import { base } from '$app/paths';
  import { t, LOCALES } from '$lib/i18n';
  import type { TileKey } from '$lib/map/tiles';
  import type { AppState } from '$lib/state/app.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
  import { cn, focusById } from '$lib/utils';
  import { Card, CardTitle } from '$lib/components/ui/card';
  import MapDataStatus from './MapDataStatus.svelte';
  import type { Snippet } from 'svelte';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check';
  import MapIcon from '@lucide/svelte/icons/map';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import PenLineIcon from '@lucide/svelte/icons/pen-line';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    app,
    onImport,
    mode = 'map',
    draft = undefined,
    statusExtra,
    hasDraftProblem = false
  }: {
    app: AppState;
    onImport: (text: string) => void;
    mode?: 'map' | 'design';
    draft?: import('$lib/state/draft.svelte').DraftState;
    statusExtra?: Snippet;
    hasDraftProblem?: boolean;
  } = $props();

  const PANEL_MS = 220;
  let panelMounted = $state(false);
  let panelOpen = $state(false);
  // Only restore focus to the trigger after the panel actually opened,
  // so we don't steal focus on initial page load.
  let restoreTriggerFocus = false;

  $effect(() => {
    if (app.menuOpen) {
      panelMounted = true;
      restoreTriggerFocus = true;
      focusById('menu-close-button');
      const frame = requestAnimationFrame(() => {
        panelOpen = true;
      });
      return () => cancelAnimationFrame(frame);
    }

    panelOpen = false;
    const timeout = setTimeout(() => {
      panelMounted = false;
      if (restoreTriggerFocus) {
        restoreTriggerFocus = false;
        focusById('menu-open-button');
      }
    }, PANEL_MS);
    return () => clearTimeout(timeout);
  });

  const menuButton =
    'h-auto w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-semibold';
  const settingsRow = 'h-8 min-h-8 w-full justify-start rounded-lg px-4 text-sm font-semibold';
  const sectionLabel =
    'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground';
  const menuIcon = 'size-4 shrink-0 text-muted-foreground';

  const flushCard =
    'max-h-[78vh] w-[min(86vw,300px)] gap-0 overflow-x-hidden overflow-y-auto rounded-none rounded-br-xl border-0 py-0 shadow-[4px_4px_16px_rgba(0,0,0,0.08)] ring-0';
  const mapHref = base ? `${base}/` : '/';
  const designHref = `${base}/design`;

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

  const clubLogo = $derived(draft?.logo ?? app.dataLogo);
  let logoFailed = $state(false);

  $effect(() => {
    clubLogo;
    logoFailed = false;
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
              id="menu-close-button"
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

            <div class="flex min-h-9 min-w-0 flex-1 items-center gap-2.5">
              {#if app.menuLevel === 'root' && clubLogo && !logoFailed}
                <img
                  src={clubLogo}
                  alt=""
                  class="size-9 shrink-0 object-contain"
                  onerror={() => (logoFailed = true)}
                />
              {/if}
              <div class="flex min-w-0 flex-1 flex-col justify-center gap-0">
                {#if app.menuLevel === 'root'}
                  <CardTitle class="text-lg font-semibold leading-tight tracking-tight">
                    {t(app.locale, 'app.title')}
                  </CardTitle>
                  <MapDataStatus {app} {onImport} {draft} />
                  {#if !draft}
                    {@render statusExtra?.()}
                  {/if}
                {:else}
                  <CardTitle class="text-lg font-semibold leading-tight tracking-tight">
                    {t(app.locale, 'settings.title')}
                  </CardTitle>
                {/if}
              </div>
            </div>
          </header>

          <div class="flex flex-col gap-6 px-5 pb-4 pt-1">
        {#if app.menuLevel === 'root'}
          <div class="flex flex-col gap-1">
            <Button
              variant="ghost"
              class={cn(menuButton, mode === 'map' && 'bg-secondary text-secondary-foreground')}
              href={mapHref}
            >
              <MapIcon class={menuIcon} />
              <span class="flex-1 text-left">{t(app.locale, 'menu.mode.map')}</span>
            </Button>
            <Button
              variant="ghost"
              class={cn(menuButton, mode === 'design' && 'bg-secondary text-secondary-foreground')}
              href={designHref}
            >
              <PenLineIcon class={menuIcon} />
              <span class="flex-1 text-left">{t(app.locale, 'menu.mode.design')}</span>
            </Button>
            <Button variant="ghost" class={menuButton} disabled>
              <ClipboardCheckIcon class={menuIcon} />
              <span class="flex-1 text-left">{t(app.locale, 'menu.mode.test')}</span>
            </Button>
            <Button variant="ghost" class={menuButton} onclick={() => app.gotoSettings()}>
              <SettingsIcon class={menuIcon} />
              <span class="flex-1 text-left">{t(app.locale, 'menu.settings')}</span>
              <ChevronRightIcon class="text-muted-foreground" />
            </Button>
          </div>
        {:else}
          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              {t(app.locale, 'settings.tiles')}
            </p>
            <div class="flex flex-col gap-1 pl-2">
              {#each ['map', 'sat'] as key (key)}
                <Button
                  variant="ghost"
                  class={cn(
                    settingsRow,
                    app.tile === key && 'bg-secondary text-secondary-foreground'
                  )}
                  onclick={() => app.setTile(key as TileKey)}
                >
                  <span class="flex-1 text-left">
                    {t(app.locale, key === 'map' ? 'settings.tiles.map' : 'settings.tiles.sat')}
                    <span class="font-medium text-muted-foreground">
                      {' · '}{t(
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
              {t(app.locale, 'settings.language')}
            </p>
            <ToggleGroup
              value={app.locale}
              onValueChange={(v) => v && app.setLocale(v as typeof app.locale)}
              class="ml-2 w-fit"
            >
              {#each LOCALES as l (l)}
                <ToggleGroupItem value={l} class="min-w-9 uppercase">
                  {l}
                </ToggleGroupItem>
              {/each}
            </ToggleGroup>
          </section>

          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              {t(app.locale, 'settings.interaction')}
            </p>
            <div class="flex min-h-8 items-center justify-between gap-3 pl-2 pr-3">
              <Label for="labels-zoom-switch" class="font-normal">
                {t(app.locale, 'settings.labels.zoomReveal')}
              </Label>
              <Switch
                id="labels-zoom-switch"
                checked={app.labels === 'zoom'}
                onCheckedChange={(v: boolean) => app.setLabels(v ? 'zoom' : 'tap')}
              />
            </div>
          </section>

          <section class="flex flex-col gap-1.5">
            <p class={sectionLabel}>
              {t(app.locale, 'settings.mapdata')}
            </p>
            <div class="flex flex-col pl-2 pr-3">
              <MapDataStatus {app} {onImport} {draft} />
              {#if !draft}
                {@render statusExtra?.()}
              {/if}
            </div>
          </section>
        {/if}
          </div>
        </div>
      </div>
    </Card>
  {:else}
    <div class="relative p-3">
      <Button
        id="menu-open-button"
        variant="ghost"
        size="icon"
        class="bg-background shadow-md hover:bg-accent"
        aria-label={t(app.locale, 'menu.settings')}
        onclick={() => app.toggleMenu()}
      >
        <MenuIcon />
      </Button>
      {#if hasDraftProblem}
        <span
          class="absolute right-2 top-2 size-2.5 rounded-full bg-destructive ring-2 ring-background"
          aria-hidden="true"
        ></span>
      {/if}
    </div>
  {/if}
</div>
