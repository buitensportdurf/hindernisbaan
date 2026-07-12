<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
  data-slot="sheet-description"
  class={cn('text-sm text-muted-foreground', className)}
  {...restProps}
/>
