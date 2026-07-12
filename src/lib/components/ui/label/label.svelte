<script lang="ts">
  import { Label as LabelPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    children,
    ...restProps
  }: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
  data-slot="label"
  class={cn('text-sm font-medium leading-none text-foreground', className)}
  {...restProps}
>
  {@render children?.()}
</LabelPrimitive.Root>
