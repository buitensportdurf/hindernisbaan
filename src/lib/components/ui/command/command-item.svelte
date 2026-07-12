<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: CommandPrimitive.ItemProps = $props();
</script>

<CommandPrimitive.Item
  data-slot="command-item"
  class={cn(
    'flex cursor-pointer flex-col items-center gap-1 rounded-md p-2 text-center text-[11px] text-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
    className
  )}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.Item>
