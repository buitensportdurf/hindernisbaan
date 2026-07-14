<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    sideOffset = 4,
    children,
    ...restProps
  }: TooltipPrimitive.ContentProps = $props();
</script>

<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content
    data-slot="tooltip-content"
    {sideOffset}
    class={cn(
      'tooltip-surface tooltip-animate-in z-[1700]',
      'data-[state=closed]:tooltip-animate-out',
      'data-[side=bottom]:tooltip-from-bottom data-[side=left]:tooltip-from-left data-[side=right]:tooltip-from-right data-[side=top]:tooltip-from-top',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
