import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const variants = cva('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500', {
  variants: { variant: { default:'bg-teal-500 text-slate-950 hover:bg-teal-400', outline:'border border-slate-300 text-slate-700 hover:bg-slate-100', subtle:'bg-slate-100 text-slate-700 hover:bg-slate-200', danger:'bg-rose-600 text-white hover:bg-rose-700' }, size:{ default:'px-5 py-3 text-sm', sm:'px-3 py-2 text-xs', lg:'px-7 py-4 text-base' } },
  defaultVariants:{ variant:'default', size:'default' }
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }
export function Button({ className, variant, size, asChild=false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variants({variant,size}),className)} {...props}/>;
}
