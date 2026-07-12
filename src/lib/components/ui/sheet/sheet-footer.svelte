<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
  data-slot="sheet-footer"
  class={cn('mt-auto flex flex-col gap-2 border-t pt-4', className)}
  {...restProps}
>
  {@render children?.()}
</div>
