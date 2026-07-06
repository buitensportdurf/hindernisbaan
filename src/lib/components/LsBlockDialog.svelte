<script lang="ts">
  import { t, type Locale } from '$lib/i18n';
  let { locale }: { locale: Locale } = $props();
</script>

<div style="position:fixed;inset:0;z-index:1600;background:var(--ink-700);display:flex;align-items:center;justify-content:center;padding:20px">
  <div style="width:min(92vw,380px);text-align:center;color:#fff">
    <div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
    </div>
    <div style="font:700 18px var(--font-sans);margin-bottom:8px">{t(locale, 'ls.title')}</div>
    <div style="font:500 14px/1.6 var(--font-sans);color:#d6d6d6">{t(locale, 'ls.body')}</div>
  </div>
</div>
