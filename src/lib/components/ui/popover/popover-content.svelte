<script lang="ts">
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    children,
    sideOffset = 6,
    align = 'start',
    ...restProps
  }: PopoverPrimitive.ContentProps = $props();
</script>

<PopoverPrimitive.Portal>
  <PopoverPrimitive.Content
    data-slot="popover-content"
    {sideOffset}
    {align}
    class={cn(
      'z-[1700] w-72 rounded-lg border bg-popover p-0 text-popover-foreground shadow-md outline-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
