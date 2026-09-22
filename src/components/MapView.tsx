import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import type { ReactNode } from "react";
import { bounds, cluster } from "../lib/geo";
import { PLACE_PIN } from "../lib/placePin";

/**
 * The one map in the app.
 *
 * Search results, a destination, the spots tab and a trip's route all render
 * through here — they differ only in what they pass in. Keeping a single
 * component means clustering, fitting and the sponsored-pin rule are decided
 * once instead of drifting apart across four screens.
 *
 * The Leaflet container carries `isolation: isolate` and `z-0` deliberately:
 * Leaflet's internal panes sit at z-index 400-700, so without a stacking
 * context of its own the map paints straight over any UI layered on top of it.
 */

/**
 * The least a map needs to know about a thing to draw it.
 *
 * `Poi` satisfies this structurally, so every existing map carries on passing
 * POIs and nothing about them changed. The trip map cannot: a day may now hold
 * a hire car counter or a restaurant, and neither is a POI. Widening this to
 * the seven fields a pin actually reads — rather than to a five-way union —
 * keeps the map ignorant of what kinds of thing exist, which is the right
 * amount for a map to know.
 */
export interface MapPlace {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  emoji: string;
  tint: string;
}

export interface MapPin {
  poi: MapPlace;
  /** 1-based position in an itinerary. Renders a numbered pin instead of an emoji. */
  order?: number;
  /** Paid placement. Rendered with a visible ring and a label in the sheet. */
  sponsored?: boolean;
  /**
   * What the pin's colour means on this map, and it means exactly one thing:
   * orange has a voice guide, navy does not. Deliberately not the POI's
   * category — six pin colours look like information while answering no
   * question, and this one maps onto the section directly below the map on the
   * home screen. Undefined keeps the original white pin every other map uses.
   */
  tone?: "story" | "plain";
  /**
   * The map home's pin: a filled orange disc with a white headphone in it.
   *
   * Distinct from `tone: "story"` on purpose. That one is a two-colour code with
   * a legend beside it, answering 「哪裡有得聽」 across a whole island. This is a
   * single kind of pin on a map where everything has a guide, so it does not
   * need a key — it needs to be recognisable at a glance from two metres away,
   * which is what the icon inside it is for.
   */
  audio?: boolean;
  /**
   * Somewhere OpenStreetMap knows about that ResoMap has nothing to say about.
   *
   * Drawn as a small grey dot rather than a pin, and deliberately quieter than
   * everything else on the map: it is context, not a destination. The 32px box
   * around the 13px dot is the touch target — the dot stays small, the tap
   * stays reachable.
   */
  context?: boolean;
  /** Drawn larger, with a ring. One at a time. */
  selected?: boolean;
  /**
   * V3 — a real restaurant or place to stay off OpenStreetMap. Each gets its own
   * colour and glyph, so the filter above the map is a convenience and not the
   * only way to tell the three kinds apart.
   */
  place?: "food" | "stay";
}

function placeIcon(kind: "food" | "stay", selected: boolean) {
  const size = selected ? 42 : 32;
  const { color, svg } = PLACE_PIN[kind];
  const ring = selected
    ? `box-shadow:0 0 0 5px ${color}33,0 4px 12px rgba(0,0,0,.3);`
    : "box-shadow:0 2px 6px rgba(0,0,0,.25);";
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:99px;background:${color};
      border:2px solid #fff;display:grid;place-items:center;${ring}">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * The headphone, as SVG rather than the 🎧 emoji.
 *
 * An emoji is a different glyph on every platform, cannot be recoloured, and at
 * 18px inside a filled disc renders as a dark smudge on half of them. This is
 * the same shape `Headphones` in ui.tsx draws, written out inline because
 * Leaflet's `divIcon` takes an HTML string and not a React element.
 */
const HEADPHONE_SVG = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"
  stroke="#fff" stroke-width="2.2" aria-hidden="true">
  <path d="M4 14v-2a8 8 0 0116 0v2" stroke-linecap="round"/>
  <rect x="2.4" y="13.4" width="4.6" height="7.2" rx="2.3" fill="#fff" stroke="none"/>
  <rect x="17" y="13.4" width="4.6" height="7.2" rx="2.3" fill="#fff" stroke="none"/>
</svg>`;

/**
 * "There is something to listen to here", at a glance.
 *
 * 40px normally and 48px when selected — big enough to read the icon inside,
 * small enough that seven of them on a phone screen are still a map rather than
 * a wall of badges. The selected one also gets a soft ring, which is cheaper to
 * read than a colour change and survives being next to an unselected twin.
 */
function audioIcon(selected: boolean) {
  const size = selected ? 48 : 40;
  const ring = selected
    ? "box-shadow:0 0 0 5px rgba(255,98,16,.22),0 4px 12px rgba(0,0,0,.3);"
    : "box-shadow:0 2px 8px rgba(0,0,0,.28);";
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:99px;
      background:#ff6210;border:2.5px solid #fff;display:grid;place-items:center;
      ${ring}transition:width .15s,height .15s">${HEADPHONE_SVG}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function pinIcon(pins: MapPin[], activeId: string | null) {
  if (pins.length > 1) {
    const n = pins.length;
    const size = n > 20 ? 46 : n > 8 ? 40 : 34;
    return divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:99px;background:#fff;
        border:2px solid #ff6210;color:#16150f;display:grid;place-items:center;
        font:700 ${Math.round(size / 3)}px/1 system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.16)">${n}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  const p = pins[0];
  const on = p.poi.id === activeId;

  /* Checked before every other style: on the map home this is the only pin
     language there is, and it must not be overridden by `order` or `tone`. */
  if (p.audio) return audioIcon(Boolean(p.selected) || on);
  if (p.place) return placeIcon(p.place, Boolean(p.selected) || on);

  if (p.context) {
    const d = p.poi.id === activeId ? 17 : 13;
    return divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;display:grid;place-items:center">
        <div style="width:${d}px;height:${d}px;border-radius:99px;background:#8d96a8;
          border:2px solid rgba(255,255,255,.92);
          box-shadow:0 1px 4px rgba(0,0,0,.25)"></div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  if (p.order != null) {
    return divIcon({
      className: "",
      html: `<div style="width:30px;height:30px;border-radius:99px;
        background:${on ? "#e2540a" : "#ff6210"};color:#fff;display:grid;place-items:center;
        font:700 14px/1 system-ui;border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.28)">${p.order}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  /* Sponsored pins get a dashed ring, never a brighter colour — a paid result
     must be identifiable, not more attractive. */
  const ring = p.sponsored
    ? "border:2px dashed #918c83;"
    : on
      ? "border:2px solid #ff6210;"
      : "";
  /* A toned pin is filled rather than outlined, and drops the emoji: at 30px on
     a saturated fill an emoji is unreadable, and here the colour is the whole
     message. The headphones mark repeats it for anyone who cannot separate the
     two hues — colour is never the only carrier. */
  if (p.tone) {
    const fill = p.tone === "story" ? "#ff6210" : "#33415c";
    const mark = p.tone === "story" ? "🎧" : "";
    /* A toned pin can also be a paid one. The dashed grey ring is the same mark
       an untoned sponsored pin wears, so paid placement reads identically
       wherever it appears — it used to be dropped silently here, which meant a
       promoted result on a toned map looked organic. */
    const edge = p.sponsored ? "2.5px dashed #918c83" : "2.5px solid #fff";
    return divIcon({
      className: "",
      html: `<div style="width:30px;height:30px;border-radius:99px;background:${fill};
        border:${edge};display:grid;place-items:center;font-size:12px;
        box-shadow:0 2px 8px rgba(0,0,0,.28)">${mark}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  return divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:99px;${ring}
      background:${on ? "#ff6210" : "#fff"};display:grid;place-items:center;font-size:16px;
      box-shadow:0 2px 8px rgba(0,0,0,.18)">${p.poi.emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

/**
 * "You are here", drawn the way every map app has taught people to read it.
 *
 * A blue disc with a white collar, sitting inside a translucent blue circle that
 * is the accuracy of the fix. The vocabulary is borrowed because it is already
 * universal; the pixels are this app's own, and nothing is copied from anybody's
 * asset library.
 *
 * Deliberately smaller than an attraction pin — 16px against 40px. On a map
 * where the orange discs are the things you can go and do, a dot that competes
 * with them for attention is a dot in the way. It is drawn last so it stays
 * above the tiles and above the ordinary pins, which is what `pane` and the
 * render order below are for.
 */
const MEd = 18;

function meIcon() {
  return divIcon({
    className: "",
    html: `<div style="width:${MEd}px;height:${MEd}px;border-radius:99px;
      background:#2F6FED;border:3px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [MEd, MEd],
    iconAnchor: [MEd / 2, MEd / 2],
  });
}

/**
 * Where the traveller is, and how sure the browser is about it.
 *
 * `accuracy` is metres and comes from `coords.accuracy` for a real fix. For the
 * demo position it is a fixed, modest figure — the circle is a visual hint, and
 * no number is ever printed, because a precision claim over a hard-coded
 * coordinate would be the one lie on the screen.
 */
export function MeMarker({
  at,
  accuracy,
}: {
  at: [number, number];
  accuracy: number;
}) {
  return (
    <>
      <Circle
        center={at}
        radius={accuracy}
        interactive={false}
        pathOptions={{
          color: "#2F6FED",
          weight: 1,
          opacity: 0.35,
          fillColor: "#2F6FED",
          fillOpacity: 0.12,
        }}
      />
      <Marker
        position={at}
        icon={meIcon()}
        interactive={false}
        /* Above every attraction pin. Leaflet stacks markers by latitude by
           default, so a pin north of the traveller would otherwise sit on top
           of the dot that is supposed to be them. */
        zIndexOffset={1000}
        alt="目前位置"
      />
    </>
  );
}

/**
 * What the two pin colours mean, on the map itself.
 *
 * Two colours with no key is decoration pretending to be data. It sits inside
 * the map rather than under it because the reader is looking at the pins when
 * the question occurs to them.
 */
export function PinLegend({
  /** The map tab counts every guide, not only ResoMap's own — see lib/audio. */
  on = "有語音故事",
  off = "還沒有",
}: {
  on?: string;
  off?: string;
} = {}) {
  return (
    <div className="pointer-events-none absolute right-2.5 top-2.5 z-10 flex flex-col gap-1 rounded-xl bg-bg/92 px-2.5 py-2 shadow-sm backdrop-blur">
      {[
        { fill: "#ff6210", label: on },
        { fill: "#33415c", label: off },
      ].map((r) => (
        <span key={r.label} className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <i
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: r.fill }}
            aria-hidden
          />
          {r.label}
        </span>
      ))}
    </div>
  );
}

function Watch({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

/** Where the map has been told to go, and how close. */
interface Focus {
  at: [number, number];
  /** Omitted for "open this place" — that always goes in close. */
  zoom?: number;
}

function Fit({ to, focus }: { to: LatLngBoundsExpression | null; focus: Focus | null }) {
  const map = useMap();
  useEffect(() => {
    /* Two different intents used to share one code path, and the cluster one was
       wrong: tapping a bubble asked to SPREAD it, but fell into the "open this
       place" branch and jumped to zoom 15 on the cluster's centroid — which on
       the Taiwan overview is open sea or farmland between three cities, with not
       a single pin left on screen and no way back but pinching out. A spread
       carries its own target zoom; a pick does not and still goes in close. */
    if (focus) map.setView(focus.at, focus.zoom ?? Math.max(map.getZoom(), 15), { animate: true });
  }, [focus, map]);
  useEffect(() => {
    if (to && !focus) map.fitBounds(to, { padding: [40, 40], animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return null;
}

/**
 * Move the map because something outside it asked.
 *
 * Keyed on `token` rather than on the coordinate: pressing 定位 twice from two
 * different corners of the map has to work both times, and two identical
 * coordinates would otherwise look like "nothing changed" to the effect.
 */
function FlyTo({ to }: { to?: { at: [number, number]; zoom?: number; token: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!to) return;
    map.flyTo(to.at, to.zoom ?? map.getZoom(), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to?.token]);
  return null;
}

export function MapView({
  pins,
  centre,
  zoom = 13,
  fit,
  route,
  spread,
  activeId,
  showMe,
  flyTo,
  onPick,
  children,
}: {
  pins: MapPin[];
  centre: [number, number];
  zoom?: number;
  /** Frame all pins on mount. Off for the browse map, on for a trip's route. */
  fit?: boolean;
  /** Draw the itinerary line through the pins, in order. */
  route?: boolean;
  /**
   * Never group these pins, however far out the map is.
   *
   * For the city overview: `cluster()` buckets by a 0.8° grid cell at zoom 7,
   * which swallows 台北, 新北 and 宜蘭 into one bubble reading "3" — while the
   * pins themselves are 32px, 43px and 46px apart at that zoom and never touch.
   * The grid was hiding three of eight cities to solve an overlap that does not
   * exist, under a caption promising eight. Measured, not guessed: the closest
   * pair of the eight anchors is 32px and the pins are 30px across.
   */
  spread?: boolean;
  activeId?: string | null;
  /** A stand-in "you are here" dot. Mock: nothing asks for real geolocation. */
  showMe?: [number, number];
  /**
   * Somewhere the map should move to, and when.
   *
   * `at` alone is not enough to drive a pan: the same coordinate handed in twice
   * has to move the map twice, because the traveller may have dragged away in
   * between and pressed the locate button again. The `token` changes on every
   * request, which is what makes the effect fire.
   */
  flyTo?: { at: [number, number]; zoom?: number; token: number } | null;
  onPick?: (poi: MapPlace) => void;
  /** Layers rendered inside the map container — the "you are here" dot. */
  children?: ReactNode;
}) {
  const [z, setZ] = useState(zoom);
  const [focus, setFocus] = useState<Focus | null>(null);

  const groups = useMemo(
    () =>
      cluster(
        pins.map((p) => ({ ...p, lat: p.poi.lat, lng: p.poi.lng })),
        // an itinerary is never clustered (the order is the point), and neither is
        // a set of pins the caller has measured as non-overlapping
        route || spread ? 99 : z,
      ),
    [pins, z, route, spread],
  );

  const box = useMemo(
    () => (fit && pins.length ? bounds(pins.map((p) => p.poi)) : null),
    [fit, pins],
  );

  const line = useMemo(
    () =>
      route
        ? [...pins]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((p) => [p.poi.lat, p.poi.lng] as [number, number])
        : [],
    [route, pins],
  );

  return (
    <MapContainer
      center={centre}
      zoom={zoom}
      zoomControl={false}
      attributionControl={false}
      style={{ isolation: "isolate" }}
      className="absolute inset-0 z-0 size-full"
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
      <Watch onZoom={setZ} />
      <Fit to={box} focus={focus} />
      <FlyTo to={flyTo} />

      {line.length > 1 && (
        <Polyline
          positions={line}
          pathOptions={{ color: "#ff6210", weight: 3.5, opacity: 0.75, dashArray: "1 7", lineCap: "round" }}
        />
      )}

      {children}

      {showMe && (
        <Marker
          position={showMe}
          interactive={false}
          icon={divIcon({
            className: "",
            html: `<div style="width:18px;height:18px;border-radius:99px;background:#2F6FED;
              border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,237,.18)"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })}
        />
      )}

      {groups.map((g, i) => (
        <Marker
          key={g.items[0].poi.id + i}
          position={[g.lat, g.lng]}
          icon={pinIcon(g.items, activeId ?? null)}
          /* Selected above the blue dot, the blue dot (1000) above an ordinary
             pin, an ordinary pin above a grey context dot. Two attractions 250 m
             apart overlap at neighbourhood zoom, and the one the traveller just
             tapped is the one that must come forward. */
          zIndexOffset={
            g.items.some((p) => p.selected || p.poi.id === activeId)
              ? 1200
              : g.items.some((p) => p.context)
                ? 0
                : 400
          }
          eventHandlers={{
            click: () => {
              if (g.items.length === 1) {
                setFocus({ at: [g.lat, g.lng] });
                onPick?.(g.items[0].poi);
              } else {
                /* Two steps in, centred on the bubble. No setZ here: setView
                   fires zoomend, Watch picks it up, and `z` — which decides the
                   clustering granularity — stays a reading of the map rather
                   than a second copy that can disagree with it. */
                setFocus({ at: [g.lat, g.lng], zoom: Math.min(16, z + 2) });
              }
            },
          }}
        />
      ))}
    </MapContainer>
  );
}

/**
 * ©️ OpenStreetMap. Required by the tile licence, so it is not optional.
 *
 * 11px, the same floor every other label in the app keeps. An attribution the
 * licence obliges us to show is the last thing to shrink below legible — set at
 * 10px it was the only text in the product a reader could not actually read.
 */
export function MapCredit() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 z-10 bg-bg/70 px-1.5 py-0.5 text-[11px] text-ink-3">
      ©️ OpenStreetMap contributors
    </div>
  );
}
