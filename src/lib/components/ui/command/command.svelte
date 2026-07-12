<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let {
    class: className,
    value = $bindable(''),
    children,
    ...restProps
  }: CommandPrimitive.RootProps = $props();
</script>

<CommandPrimitive.Root
  bind:value
  data-slot="command"
  class={cn('flex h-full w-full flex-col overflow-hidden', className)}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.Root>
