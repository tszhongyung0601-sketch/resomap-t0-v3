import type { Day, Trip } from "../types";

/**
 * A trip's days as real calendar dates.
 *
 * The itinerary stores dates the way it prints them — 「8 月 12 日」, with no
 * year — which is enough to read and not enough to book. Anything leaving the
 * app for a checkout (Klook's hotel search, a flight) needs a full date, and it
 * needs one that can still be booked: so a month and day become the next time
 * that date comes round, today included. A demo trip labelled August, opened
 * in September, books next August rather than sending somebody to a date that
 * has already gone.
 */

const WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const SHORT = ["日", "一", "二", "三", "四", "五", "六"];

export function parseMonthDay(s: string): { m: number; d: number } | null {
  const hit = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(s) ?? /(\d{1,2})\/(\d{1,2})/.exec(s);
  return hit ? { m: Number(hit[1]), d: Number(hit[2]) } : null;
}

/** The next time this month and day comes round, counting today. */
export function nextOccurrence(m: number, d: number, today = new Date()): Date {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const hit = new Date(base.getFullYear(), m - 1, d);
  return hit < base ? new Date(base.getFullYear() + 1, m - 1, d) : hit;
}

const addDays = (x: Date, n: number) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);

/** First and last day of the trip, as bookable dates. */
export function tripRange(trip: Trip): { from: Date; to: Date } {
  const first = trip.days[0] ? parseMonthDay(trip.days[0].date) : null;
  const from = first ? nextOccurrence(first.m, first.d) : addDays(new Date(), 7);
  /* Counted from the first day rather than parsed from the last, so a trip
     that crosses New Year does not end before it starts. */
  return { from, to: addDays(from, Math.max(1, trip.days.length) - 1) };
}

export const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

export function fromIso(s: string | undefined): Date | null {
  if (!s) return null;
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return hit ? new Date(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3])) : null;
}

/** 10/20（二） */
export const shortLabel = (x: Date) => `${x.getMonth() + 1}/${x.getDate()}（${SHORT[x.getDay()]}）`;

export const nightsBetween = (a: Date, b: Date) =>
  Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));

/**
 * The day after a trip's last one, in the itinerary's own wording.
 *
 * The weekday follows the last day's weekday rather than a computed calendar,
 * because the trip never said which year it is in — and a new Day 4 that
 * disagrees with Day 3 about what day of the week it is would be the first
 * thing anybody noticed.
 */
export function dayAfter(last: Day): { date: string; weekday: string } {
  const md = parseMonthDay(last.date);
  const next = md ? addDays(nextOccurrence(md.m, md.d), 1) : addDays(new Date(), 1);
  const w = WEEK.indexOf(last.weekday);
  return {
    date: `${next.getMonth() + 1} 月 ${next.getDate()} 日`,
    weekday: w >= 0 ? WEEK[(w + 1) % 7] : WEEK[next.getDay()],
  };
}

/** 「8/12 - 8/14」, rebuilt from the days themselves. */
export function datesLabel(days: Day[]): string {
  const a = days[0] ? parseMonthDay(days[0].date) : null;
  const b = days[days.length - 1] ? parseMonthDay(days[days.length - 1].date) : null;
  if (!a || !b) return "";
  return days.length === 1 ? `${a.m}/${a.d}` : `${a.m}/${a.d} - ${b.m}/${b.d}`;
}
