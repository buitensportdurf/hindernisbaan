<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  let {
    class: className,
    value = $bindable(),
    rows = 3,
    ...restProps
  }: HTMLTextareaAttributes = $props();
</script>

<textarea
  data-slot="textarea"
  bind:value
  {rows}
  class={cn(
    'flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...restProps}
></textarea>
