<script lang="ts">
  import MapPinIcon from '@lucide/svelte/icons/map-pin';
  import { getIconComponent } from '$lib/durf-ds/icons';

  let { icon, name }: { icon: string; name: string } = $props();

  const IconComp = $derived(getIconComponent(icon) ?? MapPinIcon);
</script>

<div class="landmark-pill">
  <IconComp />
  <span>{name}</span>
</div>
