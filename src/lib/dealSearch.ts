import type { SearchCat } from "../data/affiliateLinks";

/**
 * The last few searches on 更多優惠, on this device only.
 *
 * A convenience and nothing more: if storage is blocked or cleared the list is
 * simply empty, and nothing on the screen depends on it being there.
 */

export type RecentSearch = { q: string; cat: SearchCat };

const KEY = "resomap_v3_deal_searches";
const CAP = 5;

export function readRecent(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentSearch[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.q === "string") : [];
  } catch {
    return [];
  }
}

/** Newest first, and the same word in the same category only once. */
export function pushRecent(r: RecentSearch): RecentSearch[] {
  const q = r.q.trim();
  if (!q) return readRecent();
  const next = [{ q, cat: r.cat }, ...readRecent().filter((x) => !(x.q === q && x.cat === r.cat))].slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — the search still happens, it just is not remembered */
  }
  return next;
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
