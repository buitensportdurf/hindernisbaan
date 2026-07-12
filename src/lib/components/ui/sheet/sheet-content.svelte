<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import SheetOverlay from './sheet-overlay.svelte';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    class: className,
    children,
    side = 'right',
    ...restProps
  }: DialogPrimitive.ContentProps & { side?: 'right' | 'bottom' } = $props();

  const sideClasses = {
    right:
      'inset-y-0 right-0 h-full w-[min(92vw,420px)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    bottom:
      'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
  } as const;
</script>

<DialogPrimitive.Portal>
  <SheetOverlay />
  <DialogPrimitive.Content
    data-slot="sheet-content"
    class={cn(
      'fixed z-[1650] flex flex-col gap-4 bg-background p-5 shadow-xl outline-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
      sideClasses[side],
      className
    )}
    {...restProps}
  >
    {@render children?.()}
    <DialogPrimitive.Close
      class="absolute right-4 top-4 rounded-md text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <XIcon class="size-4" />
      <span class="sr-only">Close</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
