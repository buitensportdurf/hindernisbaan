<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  type Props = HTMLAttributes<HTMLDivElement> & { children?: Snippet };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<div
  data-slot="card-title"
  class={cn(
    'text-base font-medium leading-snug group-data-[size=sm]/card:text-sm',
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
