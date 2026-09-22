/* Knife and fork; a bed. Same drawing rules as the headphone. */
const FOOD_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff"
  stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
  <path d="M7 3v8M4.5 3v5a2.5 2.5 0 005 0V3M7 11v10"/>
  <path d="M17 21V3c-2 1.5-3 4-3 7h3"/>
</svg>`;
const STAY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
  stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 00-3-3h-7v5"/>
  <circle cx="7" cy="11" r="1.8" fill="#fff" stroke="none"/>
</svg>`;

export const PLACE_PIN: Record<"food" | "stay", { color: string; svg: string }> = {
  food: { color: "#E03E52", svg: FOOD_SVG },
  stay: { color: "#4C6EF5", svg: STAY_SVG },
};
