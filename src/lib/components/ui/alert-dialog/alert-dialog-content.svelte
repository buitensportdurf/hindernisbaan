<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import AlertDialogOverlay from './alert-dialog-overlay.svelte';

  let { class: className, children, ...restProps }: AlertDialogPrimitive.ContentProps = $props();
</script>

<AlertDialogPrimitive.Portal>
  <AlertDialogOverlay />
  <AlertDialogPrimitive.Content
    data-slot="alert-dialog-content"
    class={cn(
      'fixed left-1/2 top-1/2 z-[1850] flex w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-background p-6 shadow-xl outline-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </AlertDialogPrimitive.Content>
</AlertDialogPrimitive.Portal>
