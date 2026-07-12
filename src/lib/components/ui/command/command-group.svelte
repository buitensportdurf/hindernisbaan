<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    value = '',
    children,
    ...restProps
  }: CommandPrimitive.GroupProps = $props();
</script>

<CommandPrimitive.Group {value} data-slot="command-group" class={cn('py-1', className)} {...restProps}>
  <CommandPrimitive.GroupItems class={cn('grid grid-cols-4 gap-1 px-1', className)}>
    {@render children?.()}
  </CommandPrimitive.GroupItems>
</CommandPrimitive.Group>
