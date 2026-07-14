<script lang="ts">
  import { Drawer as DrawerPrimitive } from 'vaul-svelte';
  import { cn } from '$lib/utils';

  let {
    class: className,
    children,
    ...restProps
  }: DrawerPrimitive.ContentProps = $props();
</script>

<DrawerPrimitive.Portal>
  <DrawerPrimitive.Overlay
    class="fixed inset-0 z-[1650] bg-black/40"
  />
  <DrawerPrimitive.Content
    data-slot="drawer-content"
    class={cn(
      'fixed inset-x-0 bottom-0 z-[1650] mt-24 flex max-h-[85vh] flex-col rounded-t-2xl border-t bg-background',
      className
    )}
    {...restProps}
  >
    <div class="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden="true"></div>
    {@render children?.()}
  </DrawerPrimitive.Content>
</DrawerPrimitive.Portal>
