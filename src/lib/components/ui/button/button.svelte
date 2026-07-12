<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import { buttonVariants, type ButtonSize, type ButtonVariant } from './button-variants';

  type Props = (HTMLButtonAttributes | HTMLAnchorAttributes) & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    href?: string;
    children?: Snippet;
  };

  let {
    class: className,
    variant = 'default',
    size = 'default',
    type = 'button',
    href,
    children,
    ...restProps
  }: Props = $props();
</script>

{#if href}
  <a
    {href}
    class={cn(buttonVariants({ variant, size }), className)}
    {...restProps as HTMLAnchorAttributes}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    type={type as HTMLButtonAttributes['type']}
    class={cn(buttonVariants({ variant, size }), className)}
    {...restProps as HTMLButtonAttributes}
  >
    {@render children?.()}
  </button>
{/if}
