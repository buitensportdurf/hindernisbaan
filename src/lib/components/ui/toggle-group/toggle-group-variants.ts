import { type VariantProps, tv } from 'tailwind-variants';

export const toggleGroupItemVariants = tv({
  base: 'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'
});

export type ToggleGroupItemVariant = VariantProps<typeof toggleGroupItemVariants>;
