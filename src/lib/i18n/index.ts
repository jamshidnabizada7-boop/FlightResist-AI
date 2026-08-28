'use client';

/**
 * FlightResist AI 2.0 — lightweight i18n foundation.
 *
 * Deliberately simple: a plain `t(key, params?)` function backed by JSON
 * dictionaries. Because it is a pure function-call (no provider required
 * for the default locale), it can be used from any client component,
 * helper, or event handler without wiring context through the tree.
 *
 * Parametrized messages use `{name}` placeholders:
 *   t('recovery.score', { score: 92 })  →  "Score: 92/100"
 */

import { createContext, useContext } from 'react';
import en from './en.json';

export type Locale = 'en';
export type TranslationKeys = keyof typeof en;

const dictionaries: Record<Locale, Record<string, string>> = { en };

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale];
  let value = dict[key] ?? key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replaceAll(`{${k}}`, String(v));
    });
  }

  return value;
}

// React hook version — usable once an <I18nContext.Provider> is mounted;
// falls back to the module-level defaults so it works providerless too.
const I18nContext = createContext<{ t: typeof t; locale: Locale }>({ t, locale: 'en' });

export { I18nContext };
export function useTranslation() {
  return useContext(I18nContext);
}
