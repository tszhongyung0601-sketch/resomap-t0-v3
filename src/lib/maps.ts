import { track } from "./track";
import type { LegMode, Poi } from "../types";

/**
 * ResoMap answers "where should I go". Google Maps answers "how do I get there".
 *
 * Building turn-by-turn navigation is a product in itself, and a worse one than
 * the app already on everybody's phone. So the itinerary owns the plan and hands
 * off the moment the traveller actually needs to move — one tap, no sheet asking
 * which mode they meant, because the itinerary already said.
 */

/** ResoMap's leg modes to the three Google Maps supports in this version. */
const TRAVEL_MODE: Record<LegMode, "walking" | "transit" | "driving"> = {
  walk: "walking",
  train: "transit",
  bus: "transit",
  taxi: "driving",
  drive: "driving",
  /* Google Maps has a two-wheeler mode only in some countries; driving is the
     route a scooter can always take. */
  scooter: "driving",
  transit: "transit",
  self: "walking",
};

/**
 * A place name alone is ambiguous — there is a 中正路 in every city in Taiwan.
 * Sending the name plus its coordinates lets Maps label the pin the way the
 * traveller expects while still landing on the exact spot.
 */
const point = (p: Poi) => `${p.name}, ${p.area}`;

export function directionsUrl(from: Poi | null, to: Poi, mode: LegMode = "walk") {
  const params = new URLSearchParams({
    api: "1",
    destination: point(to),
    destination_place_id: "",
    travelmode: TRAVEL_MODE[mode],
  });
  params.delete("destination_place_id");
  if (from) params.set("origin", point(from));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Opens in a new tab, and `noopener` is not optional: without it the opened
 * page gets a handle on this one through `window.opener` and can navigate it
 * somewhere else. It also keeps the SPA's own history untouched.
 */
export function openDirections(from: Poi | null, to: Poi, mode: LegMode = "walk") {
  track("directions_open", { poiId: to.id });
  window.open(directionsUrl(from, to, mode), "_blank", "noopener,noreferrer");
}

/**
 * Directions to something that is not a POI — a shop, a hotel, a meeting point.
 *
 * Same hand-off, same reason: ResoMap owns the plan, the phone's map app owns
 * turn-by-turn. Coordinates go along with the name because there is a 中正路 in
 * every city in Taiwan, and a merchant called 老店 in three of them.
 */
export function openPlaceDirections(place: {
  name: string;
  area: string;
  lat: number;
  lng: number;
}) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${place.name}, ${place.area}`,
    travelmode: "walking",
  });
  /* The name labels the pin; the coordinates decide where it lands. Sending
     only the name drops people at whichever branch Maps guessed. */
  params.set("destination", `${place.lat},${place.lng}`);
  params.set("query", `${place.name}, ${place.area}`);
  window.open(
    `https://www.google.com/maps/dir/?${params.toString()}`,
    "_blank",
    "noopener,noreferrer",
  );
}
