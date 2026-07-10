<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import { Button } from '$lib/components/ui/button';
  import WifiOffIcon from '@lucide/svelte/icons/wifi-off';

  let { locale, onDismiss }: { locale: Locale; onDismiss: () => void } = $props();
</script>

<div
  class="fixed bottom-20 left-1/2 z-[1500] -translate-x-1/2"
  role="status"
  aria-live="polite"
>
  <div
    class="flex items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg"
  >
    <WifiOffIcon class="size-4 shrink-0" />
    <div>
      <p class="text-sm font-semibold">{t(locale, 'tiles.down.title')}</p>
      <p class="text-xs opacity-80">{t(locale, 'tiles.down.body')}</p>
    </div>
    <Button
      variant="ghost"
      size="sm"
      class="ml-2 shrink-0 text-background hover:bg-white/20 hover:text-background"
      onclick={onDismiss}
    >
      {t(locale, 'tiles.down.dismiss')}
    </Button>
  </div>
</div>
