import { createContext, useContext } from "react";

/**
 * Nine languages, and the traditional-Chinese string is the key.
 *
 * `t("開始今天行程")` rather than `t("trip.startToday")`. Two reasons, and both
 * are about what happens when a translation is missing rather than when it is
 * present:
 *
 *   1. The fallback is the source text. A key-based system shows `trip.startToday`
 *      or an empty button when a catalogue is incomplete — nine catalogues will
 *      be incomplete for a long time, so the failure mode has to be readable.
 *   2. Wrapping can be incremental. A string nobody has wrapped yet is still
 *      correct Chinese, so the app is never half-broken mid-migration.
 *
 * The cost is that editing the Chinese copy orphans its translations. That is
 * the right trade here: the Chinese is the product and the translations are
 * machine output that says so on screen.
 */

export const LOCALES = [
  { id: "zh-Hant", label: "繁體中文", english: "Traditional Chinese" },
  { id: "zh-Hans", label: "简体中文", english: "Simplified Chinese" },
  { id: "en", label: "English", english: "English" },
  { id: "ja", label: "日本語", english: "Japanese" },
  { id: "ko", label: "한국어", english: "Korean" },
  { id: "th", label: "ไทย", english: "Thai" },
  { id: "vi", label: "Tiếng Việt", english: "Vietnamese" },
  { id: "id", label: "Bahasa Indonesia", english: "Indonesian" },
  { id: "ms", label: "Bahasa Melayu", english: "Malay" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

export const DEFAULT_LOCALE: Locale = "zh-Hant";

/** 繁中 source string → translation. Partial by design; misses fall back. */
export type Dict = Readonly<Record<string, string>>;

/** poiId → the place's name and description in this locale. */
export interface PlaceDict {
  readonly [poiId: string]: { readonly name?: string; readonly about?: string };
}

export interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate, falling back to the Traditional Chinese source. */
  t: (zh: string) => string;
  /** A place's name in this locale, falling back to the data's own. */
  placeName: (poiId: string, zh: string) => string;
  /** A place's description, falling back to the data's own. */
  placeAbout: (poiId: string, zh: string | undefined) => string | undefined;
  /** True when the reader is not on Traditional Chinese — drives the notice. */
  translated: boolean;
}

export const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (zh) => zh,
  placeName: (_id, zh) => zh,
  placeAbout: (_id, zh) => zh,
  translated: false,
});

export const useI18n = () => useContext(I18nContext);

/** The common case: just the translator. */
export const useT = () => useContext(I18nContext).t;

const KEY = "resomap_v3_locale";

export function readLocale(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    if (v && LOCALES.some((l) => l.id === v)) return v as Locale;
  } catch {
    /* Private mode, or storage disabled. The default is a fine answer. */
  }
  return DEFAULT_LOCALE;
}

export function writeLocale(l: Locale) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* Not being able to remember the choice is survivable; crashing is not. */
  }
}
