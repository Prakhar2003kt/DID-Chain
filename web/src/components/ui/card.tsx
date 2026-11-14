import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';
export function Card({className, ...props}:HTMLAttributes<HTMLElement>) { return <section className={cn('rounded-2xl border border-slate-200 bg-white p-6 shadow-sm', className)} {...props}/>; }
export function CardTitle({children}:{children:ReactNode}) { return <h2 className="text-xl font-bold tracking-tight text-slate-900">{children}</h2>; }
