<script lang="ts">
  import {
    Drawer,
    DrawerContent,
    DrawerTitle
  } from '$lib/components/ui/drawer';
  import { Label } from '$lib/components/ui/label';
  import MapPinIcon from '@lucide/svelte/icons/map-pin';
  import { getIconComponent } from '$lib/durf-ds/icons';
  import { t, type Locale } from '$lib/i18n';
  import type { MapFeature } from '$lib/data/types';
  import FeatureKindBadge from './FeatureKindBadge.svelte';

  let {
    open = $bindable(false),
    feature,
    onClose,
    locale
  }: {
    open?: boolean;
    feature: MapFeature | null;
    onClose: () => void;
    locale: Locale;
  } = $props();

  const displayName = $derived(
    feature?.properties.name.trim() || (feature ? t(locale, 'design.editor.untitled') : '')
  );

  const landmarkIcon = $derived(
    feature?.properties.kind === 'landmark'
      ? (getIconComponent(feature.properties.icon) ?? MapPinIcon)
      : null
  );

  const sectionLabel =
    'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground';
</script>

<Drawer bind:open onOpenChange={(v) => { if (!v) onClose(); }}>
  {#if feature}
    <DrawerContent>
      <DrawerTitle class="sr-only">{displayName}</DrawerTitle>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-4">
        <div class="flex flex-wrap items-center gap-2">
          {#if feature.properties.kind === 'landmark' && landmarkIcon}
            {@const Icon = landmarkIcon}
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted">
              <Icon class="size-4" />
            </span>
          {/if}
          <p class="text-base font-medium leading-tight">{displayName}</p>
          <FeatureKindBadge kind={feature.properties.kind} {locale} />
        </div>

        {#if (feature.properties.notes ?? '').trim()}
          <div class="flex flex-col gap-1.5">
            <Label>{t(locale, 'design.editor.notes')}</Label>
            <p class="whitespace-pre-wrap text-sm text-muted-foreground">
              {feature.properties.notes}
            </p>
          </div>
        {/if}

        {#if feature.properties.kind === 'combi' && feature.properties.members.length > 0}
          <div class="flex flex-col gap-1.5">
            <p class={sectionLabel}>{t(locale, 'design.editor.members')}</p>
            <ul class="flex flex-col">
              {#each feature.properties.members as member, i (i)}
                <li class="flex flex-col">
                  <p class="text-sm text-muted-foreground">
                    {member.name.trim() || t(locale, 'design.editor.members.name')}
                  </p>
                  {#if (member.notes ?? '').trim()}
                    <p class="whitespace-pre-wrap text-xs text-muted-foreground/80">{member.notes}</p>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </DrawerContent>
  {/if}
</Drawer>
