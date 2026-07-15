<script lang="ts">
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { ALL_ICON_NAMES, filterIconNames, getIconComponent } from '$lib/durf-ds/icons';
  import { focusById } from '$lib/utils';
  import { t, type Locale } from '$lib/i18n';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Loader2Icon from '@lucide/svelte/icons/loader-2';
  import SearchIcon from '@lucide/svelte/icons/search';

  const PAGE_SIZE = 48;
  const DEBOUNCE_MS = 200;

  let {
    value,
    onSelect,
    locale
  }: {
    value: string | undefined;
    onSelect: (kebabName: string) => void;
    locale: Locale;
  } = $props();

  let open = $state(false);
  let query = $state('');
  let debouncedQuery = $state('');
  let page = $state(0);
  let searching = $state(false);

  const SelectedIcon = $derived(value ? getIconComponent(value) : undefined);
  const filtered = $derived(filterIconNames(ALL_ICON_NAMES, debouncedQuery));
  const visible = $derived(filtered.slice(0, (page + 1) * PAGE_SIZE));
  const hasMore = $derived(visible.length < filtered.length);

  $effect(() => {
    const q = query;
    searching = true;
    const timer = setTimeout(() => {
      debouncedQuery = q;
      page = 0;
      searching = false;
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (!open) {
      query = '';
      debouncedQuery = '';
      page = 0;
      searching = false;
    }
  });

  function pick(name: string) {
    onSelect(name);
    open = false;
  }
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button
        variant="outline"
        size="icon"
        class="size-9 shrink-0"
        aria-label={value ?? t(locale, 'design.icon.placeholder')}
        title={value}
        {...props}
      >
        {#if SelectedIcon}
          <SelectedIcon class="size-4" />
        {:else}
          <ImageIcon class="size-4 text-muted-foreground" />
        {/if}
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent
    class="w-72 p-0"
    align="start"
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      focusById('icon-picker-search');
    }}
  >
    <div class="flex items-center gap-2 border-b px-3 py-2">
      <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
      <Input
        id="icon-picker-search"
        bind:value={query}
        placeholder={t(locale, 'design.icon.search')}
        class="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
      {#if searching}
        <Loader2Icon class="size-4 shrink-0 animate-spin text-muted-foreground" />
      {/if}
    </div>

    {#if filtered.length === 0}
      <p class="px-3 py-6 text-center text-sm text-muted-foreground">
        {t(locale, 'design.icon.empty')}
      </p>
    {:else}
      <div
        class="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto p-2"
        class:opacity-60={searching}
      >
        {#each visible as name (name)}
          {@const Icon = getIconComponent(name)}
          <Button
            type="button"
            variant={value === name ? 'secondary' : 'ghost'}
            size="icon"
            class="size-8 shrink-0"
            title={name}
            aria-label={name}
            aria-pressed={value === name}
            onclick={() => pick(name)}
          >
            {#if Icon}
              <Icon class="size-4" />
            {/if}
          </Button>
        {/each}
      </div>

      {#if hasMore}
        <div class="border-t px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="w-full"
            onclick={() => page++}
          >
            {t(locale, 'design.icon.loadMore')}
            <span class="text-muted-foreground">({visible.length}/{filtered.length})</span>
          </Button>
        </div>
      {/if}
    {/if}
  </PopoverContent>
</Popover>
