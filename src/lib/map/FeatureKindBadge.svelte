<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { t, type Locale } from '$lib/i18n';
  import type { MapFeature } from '$lib/data/types';

  let {
    kind,
    locale
  }: {
    kind: MapFeature['properties']['kind'];
    locale: Locale;
  } = $props();

  const label = $derived.by(() => {
    switch (kind) {
      case 'obstacle':
        return t(locale, 'design.kind.obstacle');
      case 'combi':
        return t(locale, 'design.kind.combi');
      case 'landmark':
        return t(locale, 'design.kind.landmark');
    }
  });

  const variant = $derived.by(() => {
    switch (kind) {
      case 'obstacle':
        return 'destructive' as const;
      case 'combi':
        return 'accent' as const;
      case 'landmark':
        return 'muted' as const;
    }
  });
</script>

<Badge {variant}>{label}</Badge>
