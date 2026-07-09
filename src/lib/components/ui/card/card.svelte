<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  type Props = HTMLAttributes<HTMLDivElement> & {
    children?: Snippet;
    size?: 'default' | 'sm';
  };

  let { class: className, children, size = 'default', ...restProps }: Props = $props();
</script>

<div
  data-slot="card"
  data-size={size}
  class={cn(
    'group/card flex flex-col overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:1rem] gap-[var(--card-spacing)] py-[var(--card-spacing)] data-[size=sm]:[--card-spacing:0.75rem]',
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
