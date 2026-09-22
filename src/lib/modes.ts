import type { DayMode } from "../types";

/** The glyph beside each 交通方式, on the day's chip and in its sheet. */
export const MODE_ICON: Record<DayMode, string> = {
  self: "🧭",
  drive: "🚗",
  transit: "🚆",
  walk: "🚶",
  scooter: "🛵",
};
