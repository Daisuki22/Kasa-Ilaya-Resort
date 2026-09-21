import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
  outline: 'border border-input bg-background shadow-sm hover:bg-muted hover:text-foreground',
  secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90',
  ghost: 'hover:bg-muted hover:text-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizes = {
  default: 'min-h-10 px-4 py-2',
  sm: 'min-h-9 px-3 py-1.5',
  lg: 'min-h-11 px-6 py-2.5 sm:px-8',
  icon: 'h-10 w-10 shrink-0 p-0',
};

export function buttonVariants({ variant = 'default', size = 'default', className } = {}) {
  return cn(
    'inline-flex min-w-0 items-center justify-center gap-2 rounded-lg text-center text-sm font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background',
    variants[variant] ?? variants.default,
    sizes[size] ?? sizes.default,
    className
  );
}
