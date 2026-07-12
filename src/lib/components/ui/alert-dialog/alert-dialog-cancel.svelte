<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button/button-variants';

  let { class: className, children, ...restProps }: AlertDialogPrimitive.CancelProps = $props();
</script>

<AlertDialogPrimitive.Cancel
  class={cn(buttonVariants({ variant: 'outline' }), className)}
  {...restProps}
>
  {@render children?.()}
</AlertDialogPrimitive.Cancel>
