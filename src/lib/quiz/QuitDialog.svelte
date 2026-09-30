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
    onOpenChange,
    onConfirm
  }: {
    open?: boolean;
    locale: Locale;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  } = $props();
</script>

<AlertDialog bind:open {onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t(locale, 'test.quit.title')}</AlertDialogTitle>
      <AlertDialogDescription>{t(locale, 'test.quit.body')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t(locale, 'test.quit.cancel')}</AlertDialogCancel>
      <AlertDialogAction
        onclick={() => {
          open = false;
          onConfirm();
        }}
      >
        {t(locale, 'test.quit.confirm')}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
