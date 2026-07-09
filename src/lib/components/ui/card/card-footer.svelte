<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  type Props = HTMLAttributes<HTMLDivElement> & { children?: Snippet };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<div
  data-slot="card-footer"
  class={cn(
    'flex items-center rounded-b-xl border-t bg-muted/50 p-[var(--card-spacing)]',
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
