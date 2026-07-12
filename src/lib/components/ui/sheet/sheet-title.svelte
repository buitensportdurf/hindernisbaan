<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
  data-slot="sheet-title"
  class={cn('text-base font-semibold text-foreground', className)}
  {...restProps}
/>
