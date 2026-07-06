import { dict, type TKey } from './dict';

export type Locale = 'nl' | 'en';
export const LOCALES: Locale[] = ['nl', 'en'];
export const LANG_KEY = 'durf:lang';

export function detectLocale(navLang: string | undefined): Locale {
  return navLang && navLang.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

function isLocale(v: string | null): v is Locale {
  return v === 'nl' || v === 'en';
}

export function resolveInitialLocale(
  stored: string | null,
  navLang: string | undefined
): Locale {
  return isLocale(stored) ? stored : detectLocale(navLang);
}

export function t(locale: Locale, key: TKey): string {
  return dict[locale][key];
}
