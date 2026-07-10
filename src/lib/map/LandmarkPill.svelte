<script lang="ts">
  import FlagIcon from '@lucide/svelte/icons/flag';
  import UsersIcon from '@lucide/svelte/icons/users';
  import CarIcon from '@lucide/svelte/icons/car';
  import BikeIcon from '@lucide/svelte/icons/bike';
  import ParkingIcon from '@lucide/svelte/icons/square-parking';
  import ToiletIcon from '@lucide/svelte/icons/toilet';
  import MapPinIcon from '@lucide/svelte/icons/map-pin';
  import type { Component } from 'svelte';

  let { icon, name }: { icon: string; name: string } = $props();

  const ICON_MAP: Record<string, Component> = {
    flag: FlagIcon,
    users: UsersIcon,
    car: CarIcon,
    bike: BikeIcon,
    parking: ParkingIcon,
    toilet: ToiletIcon
  };

  const IconComp = $derived(ICON_MAP[icon] ?? MapPinIcon);
</script>

<div class="landmark-pill">
  <IconComp />
  <span>{name}</span>
</div>
