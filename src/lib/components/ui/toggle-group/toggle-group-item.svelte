<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { toggleGroupItemVariants } from './toggle-group-variants';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: Omit<ToggleGroupPrimitive.ItemProps, 'children'> & {
    children?: Snippet;
  } = $props();
</script>

<ToggleGroupPrimitive.Item
  data-slot="toggle-group-item"
  class={cn(toggleGroupItemVariants({}), className)}
  {...restProps}
>
  {@render children?.()}
</ToggleGroupPrimitive.Item>
