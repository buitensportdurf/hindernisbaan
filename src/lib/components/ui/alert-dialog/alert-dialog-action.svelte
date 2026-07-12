<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button/button-variants';

  let { class: className, children, ...restProps }: AlertDialogPrimitive.ActionProps = $props();
</script>

<AlertDialogPrimitive.Action
  class={cn(buttonVariants({ variant: 'destructive' }), className)}
  {...restProps}
>
  {@render children?.()}
</AlertDialogPrimitive.Action>
