import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const short = (s?: string | null) => s ? `${s.slice(0,10)}…${s.slice(-7)}` : '—';
export const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e);
