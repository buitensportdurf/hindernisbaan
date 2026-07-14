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

<div data-slot="drawer-footer" class={cn('mt-auto flex flex-col gap-2 px-5 pb-5 pt-2', className)} {...restProps}>
  {@render children?.()}
</div>
