<script lang="ts">
  import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '$lib/components/ui/sheet';
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Button } from '$lib/components/ui/button';
  import IconPicker from './IconPicker.svelte';
  import { t, type Locale } from '$lib/i18n';
  import type { TKey } from '$lib/i18n/dict';
  import type { DraftState } from '$lib/state/draft.svelte';
  import type { HindernisFeature } from '$lib/data/types';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  let {
    feature,
    draft,
    onRequestDelete,
    onClose,
    locale
  }: {
    feature: HindernisFeature | null;
    draft: DraftState;
    onRequestDelete: (id: string) => void;
    onClose: () => void;
    locale: Locale;
  } = $props();

  const KINDS_BY_GEOMETRY = {
    Point: ['obstacle', 'landmark'],
    LineString: ['obstacle'],
    Polygon: ['obstacle', 'combi']
  } as const;

  const allowedKinds = $derived(feature ? KINDS_BY_GEOMETRY[feature.geometry.type] : []);
</script>

<Sheet open={feature !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
  {#if feature}
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>{feature.properties.name || t(locale, 'design.editor.untitled')}</SheetTitle>
      </SheetHeader>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
        <div class="flex flex-col gap-1.5">
          <Label for="feature-name">{t(locale, 'design.editor.name')}</Label>
          <Input
            id="feature-name"
            value={feature.properties.name}
            oninput={(e) => draft.updateFeature(feature!.id, { name: (e.target as HTMLInputElement).value })}
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>{t(locale, 'design.editor.kind')}</Label>
          <ToggleGroup
            value={feature.properties.kind}
            onValueChange={(v) => v && draft.setKind(feature!.id, v as 'obstacle' | 'combi' | 'landmark')}
          >
            {#each ['obstacle', 'combi', 'landmark'] as const as k (k)}
              <ToggleGroupItem
                value={k}
                disabled={!(allowedKinds as readonly string[]).includes(k)}
              >
                {t(locale, `design.kind.${k}` as TKey)}
              </ToggleGroupItem>
            {/each}
          </ToggleGroup>
        </div>

        {#if feature.properties.kind === 'landmark'}
          <div class="flex flex-col gap-1.5">
            <Label>{t(locale, 'design.editor.icon')}</Label>
            <IconPicker
              value={feature.properties.icon}
              onSelect={(icon) => draft.updateFeature(feature!.id, { icon })}
              {locale}
            />
          </div>
        {/if}

        <div class="flex flex-col gap-1.5">
          <Label for="feature-notes">{t(locale, 'design.editor.notes')}</Label>
          <Textarea
            id="feature-notes"
            value={feature.properties.notes ?? ''}
            oninput={(e) => draft.updateFeature(feature!.id, { notes: (e.target as HTMLTextAreaElement).value })}
          />
        </div>

        {#if feature.properties.kind === 'combi'}
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <Label>{t(locale, 'design.editor.members')}</Label>
              <Button variant="outline" size="sm" onclick={() => draft.addMember(feature!.id)}>
                <PlusIcon class="size-3.5" />
                {t(locale, 'design.editor.members.add')}
              </Button>
            </div>
            {#each feature.properties.members as member, i (i)}
              <div class="flex items-start gap-2 rounded-md border p-2">
                <div class="flex flex-1 flex-col gap-1.5">
                  <Input
                    value={member.name}
                    placeholder={t(locale, 'design.editor.members.name')}
                    oninput={(e) => draft.updateMember(feature!.id, i, { name: (e.target as HTMLInputElement).value })}
                  />
                  <Input
                    value={member.notes ?? ''}
                    placeholder={t(locale, 'design.editor.members.notes')}
                    oninput={(e) => draft.updateMember(feature!.id, i, { notes: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <Button variant="ghost" size="icon" onclick={() => draft.removeMember(feature!.id, i)}>
                  <Trash2Icon class="size-4" />
                </Button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <SheetFooter>
        <Button variant="destructive" onclick={() => onRequestDelete(feature!.id)}>
          <Trash2Icon class="size-4" />
          {t(locale, 'design.editor.delete')}
        </Button>
      </SheetFooter>
    </SheetContent>
  {/if}
</Sheet>
