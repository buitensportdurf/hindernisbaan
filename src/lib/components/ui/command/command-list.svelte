<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: CommandPrimitive.ListProps = $props();
</script>

<CommandPrimitive.List
  data-slot="command-list"
  class={cn('max-h-72 overflow-y-auto overflow-x-hidden p-1', className)}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.List>
