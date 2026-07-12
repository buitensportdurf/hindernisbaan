<script lang="ts">
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
  import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '$lib/components/ui/command';
  import { Button } from '$lib/components/ui/button';
  import { ALL_ICON_NAMES, getIconComponent } from '$lib/durf-ds/icons';
  import { t, type Locale } from '$lib/i18n';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';

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
  const SelectedIcon = $derived(value ? getIconComponent(value) : undefined);
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button variant="outline" class="w-full justify-between" {...props}>
        <span class="flex items-center gap-2">
          {#if SelectedIcon}
            <SelectedIcon class="size-4" />
            <span>{value}</span>
          {:else}
            <span class="text-muted-foreground">{t(locale, 'design.icon.placeholder')}</span>
          {/if}
        </span>
        <ChevronsUpDownIcon class="size-4 text-muted-foreground" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-80 p-0">
    <Command>
      <CommandInput placeholder={t(locale, 'design.icon.search')} />
      <CommandList>
        <CommandEmpty>{t(locale, 'design.icon.empty')}</CommandEmpty>
        <CommandGroup>
          {#each ALL_ICON_NAMES as name (name)}
            {@const Icon = getIconComponent(name)}
            <CommandItem
              value={name}
              onSelect={() => {
                onSelect(name);
                open = false;
              }}
            >
              {#if Icon}
                <Icon class="size-5" />
              {/if}
              <span class="truncate">{name}</span>
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
