/**
 * Reading and writing the small amount of state this demo remembers.
 *
 * Every store in `lib/` had grown its own copy of the same try/catch — storage
 * can be unavailable in private mode, full, or holding something written by a
 * different version of the app, and in all three cases the right answer is to
 * carry on with nothing rather than take the screen down over a saved list.
 *
 * The version stamp is the part worth explaining. A demo's fixtures change: the
 * Hualien trip gains a day, a stop moves, a new place is added. Without a stamp,
 * the first person to open the app would have last month's itinerary pinned in
 * their browser for ever, and the only way out would be knowing to clear site
 * data. Bumping `VERSION` retires everything written before it, which is the
 * behaviour a demo wants and roughly the opposite of what a real product wants.
 */

/** Bump when a change to the fixtures should retire what is already stored. */
const VERSION = 3;

interface Envelope<T> {
  v: number;
  data: T;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Envelope<T>>;
    /* Written by an older build, or by something that is not this app at all.
       Either way it is not ours to interpret. */
    if (parsed?.v !== VERSION || parsed.data === undefined) return fallback;
    return parsed.data as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: VERSION, data } satisfies Envelope<T>));
  } catch {
    /* Out of quota or private mode. The session still works; only the
       remembering is lost, and that is better than losing the tap. */
  }
}

export function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Nothing to do. If it cannot be removed it could not have been written. */
  }
}

export const TRIPS_KEY = "resomap_v3_trips";
export const DAY_EDITS_KEY = "resomap_v3_day_edits";
