import { type VariantProps, tv } from 'tailwind-variants';

export const badgeVariants = tv({
  base: 'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-foreground',
      destructive: 'border-transparent bg-destructive/10 text-destructive',
      accent: 'border-transparent bg-accent text-accent-foreground',
      muted: 'border-transparent bg-muted text-muted-foreground'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
