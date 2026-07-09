<script lang="ts">
  import '../app.css';
  import { dev } from '$app/environment';
  import { Agentation } from 'agentation-svelte';

  let { children } = $props();
</script>

{@render children()}

{#if dev}
  <Agentation endpoint="http://localhost:4747" />
{/if}
