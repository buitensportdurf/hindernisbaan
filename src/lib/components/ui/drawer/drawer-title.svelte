<script lang="ts">
  import { Drawer as DrawerPrimitive } from 'vaul-svelte';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps }: DrawerPrimitive.TitleProps = $props();
</script>

<DrawerPrimitive.Title
  data-slot="drawer-title"
  class={cn('text-base font-semibold text-foreground', className)}
  {...restProps}
/>
