<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  export type RootProps = Omit<ToggleGroupPrimitive.RootProps & { type: 'single' }, 'type'>;

  let {
    class: className,
    value = $bindable(''),
    children,
    ...restProps
  }: RootProps & { type?: 'single' } = $props();
</script>

<ToggleGroupPrimitive.Root
  bind:value
  type="single"
  data-slot="toggle-group"
  class={cn('inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1', className)}
  {...restProps}
>
  {@render children?.()}
</ToggleGroupPrimitive.Root>
