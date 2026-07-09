<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  type Props = HTMLAttributes<HTMLDivElement> & { children?: Snippet };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<div
  data-slot="card-header"
  class={cn(
    'grid auto-rows-min items-start gap-1 rounded-t-xl px-[var(--card-spacing)] group/card-header has-[[data-slot=card-action]]:grid-cols-[1fr_auto] has-[[data-slot=card-description]]:grid-rows-[auto_auto]',
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
