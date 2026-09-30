import { t, type Locale } from '$lib/i18n';
import type { TKey } from '$lib/i18n/dict';
import { BINS } from './quiz';

/** Mountain bands from the valley floor to the summit; green from the pass mark up. */
export const BIN_COLORS = ['#efe8d4', '#e5dabb', '#d9c99c', '#b9dcb9', '#86c289', '#357638'] as const;
export const BIN_HEIGHTS = [14, 20, 27, 36, 46, 58] as const;

/** Rank names stay Dutch in every UI language. */
export function binName(_locale: Locale, index: number): string {
  return t('nl', `test.bin.${BINS[index].key}` as TKey);
}

/** Text on white, darkened from each band so sand stays readable. */
export const BIN_LABEL_COLORS = ['#7a6840', '#6e5c32', '#5c4a24', '#3a7a3e', '#2c6b32', '#1f5a28'] as const;

export function binRange(index: number): { from: number; to: number } {
  return { from: BINS[index].min, to: BINS[index + 1]?.min ?? 100 };
}

/** Height of the mountain step under a score, for placing markers on the ridge. */
export function ridgeHeight(percent: number): number {
  let h: number = BIN_HEIGHTS[0];
  BINS.forEach((b, i) => {
    if (percent >= b.min) h = BIN_HEIGHTS[i];
  });
  return h;
}

export function formatRunDate(locale: Locale, iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  return `${day} · ${time}`;
}
