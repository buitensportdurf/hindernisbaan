<script lang="ts">
  import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel
  } from '$lib/components/ui/alert-dialog';
  import { t, type Locale } from '$lib/i18n';

  let {
    open = $bindable(false),
    locale,
    onConfirm
  }: {
    open?: boolean;
    locale: Locale;
    onConfirm: () => void;
  } = $props();
</script>

<AlertDialog bind:open>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t(locale, 'draft.discard.title')}</AlertDialogTitle>
      <AlertDialogDescription>{t(locale, 'draft.discard.body')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t(locale, 'draft.discard.cancel')}</AlertDialogCancel>
      <AlertDialogAction onclick={onConfirm}>{t(locale, 'draft.discard.confirm')}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
