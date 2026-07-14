<script lang="ts">
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
  import { Card } from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
  } from '$lib/components/ui/tooltip';
  import { t, type Locale } from '$lib/i18n';
  import type { TKey } from '$lib/i18n/dict';
  import CircleSmallIcon from '@lucide/svelte/icons/circle-small';
  import FlagIcon from '@lucide/svelte/icons/flag';
  import SplineIcon from '@lucide/svelte/icons/spline';
  import HexagonIcon from '@lucide/svelte/icons/hexagon';
  import SquareIcon from '@lucide/svelte/icons/square';
  import EraserIcon from '@lucide/svelte/icons/eraser';
  import type { DrawTool } from './drawTool';
  import type { Component } from 'svelte';

  let {
    tool = $bindable(null as DrawTool),
    locale,
    selectedId = null,
    onDeleteSelected
  }: {
    tool?: DrawTool;
    locale: Locale;
    selectedId?: string | null;
    onDeleteSelected?: () => void;
  } = $props();

  function toggle(value: string) {
    if (value === 'remove' && selectedId) {
      onDeleteSelected?.();
      tool = null;
      return;
    }
    tool = (value || null) as DrawTool;
  }

  type ToolbarTool = Exclude<DrawTool, null>;
  type ToolItem = { value: ToolbarTool; labelKey: TKey; icon: Component };

  const createTools: ToolItem[] = [
    { value: 'point', labelKey: 'design.tool.point', icon: CircleSmallIcon },
    { value: 'line', labelKey: 'design.tool.line', icon: SplineIcon },
    { value: 'polygon', labelKey: 'design.tool.polygon', icon: HexagonIcon },
    { value: 'rectangle', labelKey: 'design.tool.rectangle', icon: SquareIcon },
    { value: 'landmark', labelKey: 'design.tool.landmark', icon: FlagIcon }
  ];

  const editTools: ToolItem[] = [
    { value: 'remove', labelKey: 'design.tool.remove', icon: EraserIcon }
  ];
</script>

<div class="pointer-events-none absolute bottom-6 left-1/2 z-[1200] -translate-x-1/2">
  <Card size="sm" class="pointer-events-auto p-1 shadow-lg">
    <TooltipProvider delayDuration={300}>
      <div class="flex items-center gap-1">
        <ToggleGroup
          value={tool ?? ''}
          onValueChange={toggle}
          class="bg-transparent p-0"
        >
          {#each createTools as item (item.value)}
            {@render toolButton(item)}
          {/each}
        </ToggleGroup>

        <Separator orientation="vertical" class="mx-0.5 h-6" />

        <ToggleGroup
          value={tool ?? ''}
          onValueChange={toggle}
          class="bg-transparent p-0"
        >
          {#each editTools as item (item.value)}
            {@render toolButton(item)}
          {/each}
        </ToggleGroup>
      </div>
    </TooltipProvider>
  </Card>
</div>

{#snippet toolButton(item: ToolItem)}
  {@const Icon = item.icon}
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <ToggleGroupItem
          value={item.value}
          aria-label={t(locale, item.labelKey)}
          {...props}
        >
          <Icon />
        </ToggleGroupItem>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent side="top">
      {t(locale, item.labelKey)}
    </TooltipContent>
  </Tooltip>
{/snippet}
