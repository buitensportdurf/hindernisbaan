<script lang="ts">
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
  import { Card } from '$lib/components/ui/card';
  import { t, type Locale } from '$lib/i18n';
  import MapPinIcon from '@lucide/svelte/icons/map-pin';
  import SplineIcon from '@lucide/svelte/icons/spline';
  import HexagonIcon from '@lucide/svelte/icons/hexagon';
  import SquareIcon from '@lucide/svelte/icons/square';
  import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
  import EraserIcon from '@lucide/svelte/icons/eraser';
  import type { DrawTool } from './drawTool';

  let {
    tool = $bindable(null as DrawTool),
    locale
  }: {
    tool?: DrawTool;
    locale: Locale;
  } = $props();

  function toggle(value: string) {
    tool = (value || null) as DrawTool;
  }
</script>

<div class="pointer-events-none absolute bottom-6 left-1/2 z-[1200] -translate-x-1/2">
  <Card size="sm" class="pointer-events-auto p-1 shadow-lg">
    <ToggleGroup
      value={tool ?? ''}
      onValueChange={toggle}
      class="bg-transparent p-0"
    >
      <ToggleGroupItem value="point" aria-label={t(locale, 'design.tool.point')}>
        <MapPinIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="line" aria-label={t(locale, 'design.tool.line')}>
        <SplineIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="polygon" aria-label={t(locale, 'design.tool.polygon')}>
        <HexagonIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="rectangle" aria-label={t(locale, 'design.tool.rectangle')}>
        <SquareIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="edit" aria-label={t(locale, 'design.tool.edit')}>
        <MousePointer2Icon />
      </ToggleGroupItem>
      <ToggleGroupItem value="remove" aria-label={t(locale, 'design.tool.remove')}>
        <EraserIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  </Card>
</div>
