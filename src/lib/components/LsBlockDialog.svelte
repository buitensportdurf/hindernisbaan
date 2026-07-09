<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  import LockIcon from '@lucide/svelte/icons/lock';

  let { locale }: { locale: Locale } = $props();
</script>

<div class="fixed inset-0 z-[1600] flex items-center justify-center bg-[var(--ink-700)] p-5">
  <div class="w-[min(92vw,380px)] text-center text-white">
    <div
      class="mx-auto mb-4 flex size-[52px] items-center justify-center rounded-[14px] bg-white/10"
    >
      <LockIcon class="size-[26px]" />
    </div>
    <h1 class="mb-2 text-lg font-bold">{t(locale, 'ls.title')}</h1>
    <p class="text-sm font-medium leading-relaxed text-[#d6d6d6]">{t(locale, 'ls.body')}</p>
  </div>
</div>
