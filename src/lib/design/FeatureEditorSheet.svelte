<script lang="ts">
  import { tick } from 'svelte';
  import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerFooter
  } from '$lib/components/ui/drawer';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Button } from '$lib/components/ui/button';
  import IconPicker from './IconPicker.svelte';
  import AddNotesButton from './AddNotesButton.svelte';
  import { t, type Locale } from '$lib/i18n';
  import type { DraftState } from '$lib/state/draft.svelte';
  import type { MapFeature } from '$lib/data/types';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  let {
    open = $bindable(false),
    feature,
    draft,
    onRequestDelete,
    onClose,
    locale
  }: {
    open?: boolean;
    feature: MapFeature | null;
    draft: DraftState;
    onRequestDelete: (id: string) => void;
    onClose: () => void;
    locale: Locale;
  } = $props();

  let notesOpen = $state(false);
  let notesInitFor = $state<string | null>(null);
  let memberNotesOpen = $state<Record<number, boolean>>({});
  let memberNotesInitFor = $state<string | null>(null);

  $effect(() => {
    if (!open || !feature) {
      notesInitFor = null;
      notesOpen = false;
      memberNotesInitFor = null;
      memberNotesOpen = {};
      return;
    }
    if (notesInitFor !== feature.id) {
      notesInitFor = feature.id;
      notesOpen = (feature.properties.notes ?? '').trim().length > 0;
    }
    if (feature.properties.kind === 'combi' && memberNotesInitFor !== feature.id) {
      memberNotesInitFor = feature.id;
      const next: Record<number, boolean> = {};
      feature.properties.members.forEach((member, i) => {
        if ((member.notes ?? '').trim().length > 0) next[i] = true;
      });
      memberNotesOpen = next;
    }
  });

  async function openNotes() {
    notesOpen = true;
    await tick();
    document.getElementById('feature-notes')?.focus();
  }

  async function openMemberNotes(index: number) {
    memberNotesOpen = { ...memberNotesOpen, [index]: true };
    await tick();
    document.getElementById(`member-notes-${index}`)?.focus();
  }

  function removeNotes() {
    if (!feature) return;
    draft.updateFeature(feature.id, { notes: '' });
    notesOpen = false;
  }

  function removeMemberNotes(index: number) {
    if (!feature) return;
    draft.updateMember(feature.id, index, { notes: '' });
    const next = { ...memberNotesOpen };
    delete next[index];
    memberNotesOpen = next;
  }

  function onNotesBlur(e: FocusEvent) {
    if (!feature) return;
    const value = (e.target as HTMLTextAreaElement).value.trim();
    draft.updateFeature(feature.id, { notes: value });
    if (!value) notesOpen = false;
  }

  function onMemberNotesBlur(index: number, e: FocusEvent) {
    if (!feature) return;
    const value = (e.target as HTMLTextAreaElement).value.trim();
    draft.updateMember(feature.id, index, { notes: value });
    if (!value) {
      const next = { ...memberNotesOpen };
      delete next[index];
      memberNotesOpen = next;
    }
  }
</script>

<Drawer bind:open onOpenChange={(v) => { if (!v) onClose(); }}>
  {#if feature}
    <DrawerContent>
      <DrawerTitle class="sr-only">
        {feature.properties.name || t(locale, 'design.editor.untitled')}
      </DrawerTitle>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-4">
        {#if feature.properties.kind === 'landmark'}
          <div class="flex flex-col gap-1.5">
            <Label for="feature-name">{t(locale, 'design.editor.name')}</Label>
            <div class="flex items-center gap-2">
              <IconPicker
                value={feature.properties.icon}
                onSelect={(icon) => draft.updateFeature(feature!.id, { icon })}
                {locale}
              />
              <Input
                id="feature-name"
                class="min-w-0 flex-1"
                value={feature.properties.name}
                placeholder={t(locale, 'design.editor.untitled')}
                oninput={(e) => draft.updateFeature(feature!.id, { name: (e.target as HTMLInputElement).value })}
              />
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-1.5">
            <Label for="feature-name">{t(locale, 'design.editor.name')}</Label>
            <Input
              id="feature-name"
              value={feature.properties.name}
              placeholder={t(locale, 'design.editor.untitled')}
              oninput={(e) => draft.updateFeature(feature!.id, { name: (e.target as HTMLInputElement).value })}
            />
          </div>
        {/if}

        {#if notesOpen}
          <div class="flex flex-col gap-1.5">
            <Label for="feature-notes">{t(locale, 'design.editor.notes')}</Label>
            <Textarea
              id="feature-notes"
              value={feature.properties.notes ?? ''}
              rows={3}
              oninput={(e) => draft.updateFeature(feature!.id, { notes: (e.target as HTMLTextAreaElement).value })}
              onblur={onNotesBlur}
            />
            {#if (feature.properties.notes ?? '').trim()}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="self-start px-0 text-muted-foreground hover:text-foreground"
                onclick={removeNotes}
              >
                {t(locale, 'design.editor.notes.remove')}
              </Button>
            {/if}
          </div>
        {:else}
          <AddNotesButton {locale} onclick={openNotes} />
        {/if}

        {#if feature.properties.kind === 'combi'}
          <div class="flex flex-col gap-2">
            <Label>{t(locale, 'design.editor.members')}</Label>
            {#each feature.properties.members as member, i (i)}
              <div class="flex flex-col gap-1.5">
                <div class="flex items-start gap-2">
                  <Input
                    class="min-w-0 flex-1"
                    value={member.name}
                    placeholder={t(locale, 'design.editor.members.name')}
                    oninput={(e) => draft.updateMember(feature!.id, i, { name: (e.target as HTMLInputElement).value })}
                  />
                  {#if !memberNotesOpen[i]}
                    <AddNotesButton variant="icon" {locale} onclick={() => openMemberNotes(i)} />
                  {/if}
                  <Button variant="ghost" size="icon" onclick={() => draft.removeMember(feature!.id, i)}>
                    <Trash2Icon class="size-4" />
                  </Button>
                </div>
                {#if memberNotesOpen[i]}
                  <Textarea
                    id="member-notes-{i}"
                    value={member.notes ?? ''}
                    rows={2}
                    placeholder={t(locale, 'design.editor.members.notes')}
                    oninput={(e) => draft.updateMember(feature!.id, i, { notes: (e.target as HTMLTextAreaElement).value })}
                    onblur={(e) => onMemberNotesBlur(i, e)}
                  />
                  {#if (member.notes ?? '').trim()}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="self-start px-0 text-muted-foreground hover:text-foreground"
                      onclick={() => removeMemberNotes(i)}
                    >
                      {t(locale, 'design.editor.notes.remove')}
                    </Button>
                  {/if}
                {/if}
              </div>
            {/each}
            <Button
              variant="outline"
              size="sm"
              class="self-start"
              onclick={() => draft.addMember(feature!.id)}
            >
              <PlusIcon class="size-3.5" />
              {t(locale, 'design.editor.members.add')}
            </Button>
          </div>
        {/if}
      </div>

      <DrawerFooter class="flex-row gap-2 border-t pt-4">
        <Button class="flex-1" onclick={onClose}>
          {t(locale, 'design.editor.done')}
        </Button>
        <Button class="flex-1" variant="destructive" onclick={() => onRequestDelete(feature!.id)}>
          <Trash2Icon class="size-4" />
          {t(locale, 'design.editor.delete')}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  {/if}
</Drawer>
