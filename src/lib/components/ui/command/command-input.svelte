<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';
  import SearchIcon from '@lucide/svelte/icons/search';

  let {
    class: className,
    value = $bindable(''),
    ...restProps
  }: CommandPrimitive.InputProps = $props();
</script>

<div class="flex items-center gap-2 border-b px-3">
  <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
  <CommandPrimitive.Input
    bind:value
    data-slot="command-input"
    class={cn(
      'flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50',
      className
    )}
    {...restProps}
  />
</div>
