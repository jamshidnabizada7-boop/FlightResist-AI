'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Thin client wrapper around next-themes so the server-side root layout
 * can mount the provider without pulling client-only code into it.
 * Dark is the default (the console is designed dark-first); users can
 * toggle to light from the header.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
