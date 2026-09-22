import { useEffect, useMemo, useRef, useState } from "react";
import { MapCredit, MapView, MeMarker, type MapPin } from "../components/MapView";
import { PoiImage } from "../components/Cover";
import { Button, Headphones, Sheet } from "../components/ui";
import {
  NEARBY_ATTRACTIONS,
  oneLine,
  type Attraction,
} from "../data/nearbyAttractions";
import { DEFAULT_AREA_LABEL } from "../data/location";
import { distance, km, type LatLng } from "../lib/geo";
import { FAILURE_MESSAGE, locate } from "../lib/geolocation";
import { setHere, useHere } from "../lib/here";
import { describe, useNow } from "../lib/weather";
import { nearbyFoodStay, nearbyOsmPlaces, type OsmPlace } from "../lib/overpass";
import { OSM_SNAPSHOT } from "../data/osmSnapshot";
import { PLACE_PIN } from "../lib/placePin";
import { AddToTrip } from "../components/AddToTrip";
import { searchUrl } from "../data/affiliateLinks";
import { togglePlace, useSaved } from "../lib/saved";
import { audiosFor } from "../lib/audio";
import { openPlaceDirections } from "../lib/maps";
import { useNav } from "../nav";
import type { PlaceRef, Poi, Trip } from "../types";

/**
 * The map home: where I am, and what is worth walking to.
 *
 * The block used to answer a different question — it showed the island, or the
 * stops on the trip you had already planned. Both are about somewhere else. This
 * one is about here: a blue dot that is you, orange headphones that are places
 * with a guide, and one tap between them and playing something.
 *
 * Three rules hold it together.
 *
 * **It opens without asking for anything.** `DEFAULT_DEMO_LOCATION` is on screen
 * before the first frame. A permission prompt in front of the first screen of
 * the product is a prompt that gets denied, and on the laptop a demo is shown
 * from it can hang until the timeout. Real location is a button.
 *
 * **Every pin means the same thing.** All seven places have a recorded guide, so
 * there is one pin language and therefore no legend. The moment a map needs a
 * key to be read, the key is doing work the pins should have done.
 *
 * V3 round 2 added two more kinds on request — 餐廳 and 住宿, real businesses
 * off OpenStreetMap — and kept the rule's intent: each kind has its own colour
 * and glyph, so a pin still says what it is without a key, and a row of
 * filters above the map lets the traveller look at one kind at a time.
 *
 * **It is not a separate demo.** Tapping through lands on the same POI screen
 * everything else links to, which is what carries the traveller into the guide
 * and, at the end of it, into 周邊推薦.
 */
export function MapHome() {
  const nav = useNav();

  /* Where the traveller is, from the store rather than from this component.
     有故事的地方 sits directly under this map and sorts by the same position, so
     holding it here would let one screen give two answers about where you are —
     a map saying 「新店附近」 above a rail leading with 七星潭. */
  const fix = useHere();
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  /** Bumped to ask the map to move; see MapView's `FlyTo`. */
  const [flight, setFlight] = useState<{
    at: [number, number];
    zoom?: number;
    token: number;
  } | null>(null);
  const token = useRef(0);

  /* Attractions, nearest first, with the distance recomputed from wherever the
     traveller currently is — so pressing 定位 really does change every number
     on the screen and not just the dot. */
  const near = useMemo(
    () =>
      NEARBY_ATTRACTIONS.map((a) => ({ a, metres: distance(fix.at, a.poi) })).sort(
        (x, y) => x.metres - y.metres,
      ),
    [fix.at],
  );

  /* The hybrid half: OpenStreetMap's own index of what else is around.
     Capped at three, dropped where it duplicates something curated, and drawn
     as a plain navy pin rather than an orange headphone — because the one thing
     an orange headphone is allowed to mean is "press play". Every failure path
     in `nearbyOsmPlaces` resolves to an empty array, so the map that a
     rate-limited or offline Overpass produces is exactly the curated seven. */
  const [osm, setOsm] = useState<OsmPlace[]>([]);
  useEffect(() => {
    let live = true;
    setOsm([]);
    nearbyOsmPlaces(fix.at, 1200).then((places) => {
      if (!live) return;
      const fresh = places
        .filter(
          (o) =>
            /* Not a second copy of somewhere curated, and not sitting under the
               blue dot — a grey dot on top of "you are here" costs more than the
               place it marks is worth. */
            distance(fix.at, o.at) > 150 &&
            !NEARBY_ATTRACTIONS.some(
              (a) => distance(a.poi, o.at) < 180 || a.poi.name === o.name,
            ),
        )
        .sort((a, b) => distance(fix.at, a.at) - distance(fix.at, b.at))
        .slice(0, 3);
      setOsm(fresh);
    });
    return () => {
      live = false;
    };
  }, [fix.at]);

  const [pickedOsm, setPickedOsm] = useState<OsmPlace | null>(null);

  /* 餐廳 and 住宿. Seeded from the snapshot when the traveller is near the
     default spot, so the pins are there on the first frame, then replaced by
     the live answer when it arrives. A failed live request keeps the seed; a
     successful one that finds nothing means there is nothing, and says so. */
  const [filter, setFilter] = useState<Filter>("all");
  const [places, setPlaces] = useState(() => pickPlaces(fix.at, snapshotNear(fix.at)));
  const [pickedPlace, setPickedPlace] = useState<PlaceRef | null>(null);
  const [adding, setAdding] = useState<{ place: PlaceRef; trip: Trip } | null>(null);
  const [choosingTrip, setChoosingTrip] = useState(false);
  /* Fit the map to its pins once, on the first paint, and never again —
     not when the live places land, not when a filter changes. */
  const [autoFit, setAutoFit] = useState(true);
  const saved = useSaved();

  useEffect(() => {
    let live = true;
    setPlaces(pickPlaces(fix.at, snapshotNear(fix.at)));
    nearbyFoodStay(fix.at).then((res) => {
      if (!live || !res) return;
      setAutoFit(false);
      setPlaces(pickPlaces(fix.at, res));
    });
    return () => {
      live = false;
    };
  }, [fix.at]);

  const showSights = filter === "all" || filter === "sight";
  const pins = useMemo<MapPin[]>(
    () => [
      ...(filter === "all" || filter === "food" ? places.food : []).map((p) => placePin(p, pickedPlace)),
      ...(filter === "all" || filter === "stay" ? places.stay : []).map((p) => placePin(p, pickedPlace)),
      ...(showSights ? near : []).map(({ a }) => ({
        poi: a.poi,
        audio: true,
        selected: a.id === picked,
      })),
      /* MapPin takes a Poi and an Overpass node is not one; it reads id, name,
         lat, lng and kind off the record and nothing else, so a stand-in with
         those is the whole contract. `context` is the small grey dot: present,
         tappable, and visibly not one of the seven. */
      ...(showSights ? osm : []).map((o) => ({
        poi: {
          id: `osm:${o.id}`,
          name: o.name,
          destId: "",
          area: "",
          kind: "attraction",
          lat: o.at.lat,
          lng: o.at.lng,
          emoji: "",
          tint: "#E6EAF3",
          stayMin: 30,
        } as Poi,
        context: true,
      })),
    ],
    [near, picked, osm, places, filter, pickedPlace, showSights],
  );

  const chosen = picked ? near.find((n) => n.a.id === picked) : undefined;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function fly(at: LatLng, zoom?: number) {
    setAutoFit(false);
    token.current += 1;
    setFlight({ at: [at.lat, at.lng], zoom, token: token.current });
  }

  function select(id: string) {
    /* 餐廳 and 住宿 first: their ids share the `osm:` prefix with the grey
       context dots, and the two lists never overlap. */
    const place = [...places.food, ...places.stay].find((p) => p.id === id);
    if (place) {
      setPicked(null);
      setPickedOsm(null);
      setPickedPlace(place);
      setAutoFit(false);
      fly(place);
      return;
    }
    if (id.startsWith("osm:")) {
      const o = osm.find((x) => `osm:${x.id}` === id);
      if (o) {
        setPicked(null);
        setPickedOsm(o);
        fly(o.at);
      }
      return;
    }
    setPickedOsm(null);
    const hit = near.find((n) => n.a.id === id);
    if (!hit) return;
    setPicked(id);
    setQ("");
    setSearching(false);
    /* A nudge, not a jump. The traveller tapped something they could already
       see; re-framing the whole map around it loses the context they used to
       choose it. */
    fly(hit.a.poi);
  }

  async function onLocate() {
    if (locating) return;
    setLocating(true);
    const res = await locate();
    setLocating(false);
    if (res.ok) {
      setHere(res.fix);
      fly(res.fix.at, 15);
      return;
    }
    /* The map keeps the demo position and says so. Nothing is cleared, nothing
       goes blank, and the failure is a sentence rather than an alert(). */
    setToast(FAILURE_MESSAGE[res.reason]);
  }

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return near
      .filter(({ a }) =>
        `${a.poi.name} ${a.poi.area}`.toLowerCase().includes(needle),
      )
      .slice(0, 5);
  }, [q, near]);

  return (
    <div className="relative shrink-0 pb-6">
      <div className="relative h-[420px] overflow-hidden">
        <MapView
          pins={pins}
          centre={[fix.at.lat, fix.at.lng]}
          zoom={14}
          /* Frame all seven on the first paint, so the answer to "what is around
             me" is visible rather than something you have to go looking for —
             and then never again. `fitBounds` re-runs whenever the pin list
             changes, which is the same thing as re-centring the map behind the
             traveller's back: once after a flight, undoing 定位 or a search
             result, and once when a late Overpass response arrives, undoing a
             drag. Both of those are the auto-recentre nobody wants, so the
             first flight or the first merged place ends the auto-fit. */
          fit={autoFit && !flight && osm.length === 0}
          /* Never grouped. On a map whose whole message is "these are the places
             with a guide", a bubble reading 3 is three places you cannot see. */
          spread
          activeId={picked}
          flyTo={flight}
          onPick={(p) => select(p.id)}
        >
          <MeMarker at={[fix.at.lat, fix.at.lng]} accuracy={fix.accuracy} />
        </MapView>

        {/* Small, and it stays small. The map is the hero; this is a caption. */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex max-w-[80%] items-center gap-1.5 rounded-xl bg-bg/92 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-2 shadow-sm backdrop-blur">
          <span className="size-2 shrink-0 rounded-full bg-[#2F6FED]" aria-hidden />
          <span className="truncate">
            {fix.real ? "你附近" : DEFAULT_AREA_LABEL}
          </span>
          <span className="text-ink-3" aria-hidden>
            ·
          </span>
          <Headphones size={11} />
          <span className="num shrink-0">{near.length} 個可以聽</span>
          <Sky />
        </div>

        {/* One kind at a time, or all of them. White pills over the map, so they
            read as controls on top of it rather than part of it. */}
        <div className="absolute inset-x-0 top-[46px] z-10 flex gap-1.5 overflow-x-auto px-2.5 pb-1 no-scrollbar">
          {FILTERS.map((f) => {
            const on = f.id === filter;
            const n = f.id === "food" ? places.food.length : f.id === "stay" ? places.stay.length : null;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id);
                  setAutoFit(false);
                  setPicked(null);
                  setPickedPlace(null);
                }}
                aria-pressed={on}
                className={`relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold shadow-[0_1px_6px_rgba(0,0,0,.16)] transition after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] ${
                  on ? "bg-ink text-white" : "bg-bg text-ink-2 active:bg-surface"
                }`}
              >
                {f.dot && (
                  <span className="size-2.5 rounded-full" style={{ background: f.dot }} aria-hidden />
                )}
                {f.label}
                {n !== null && <span className={`num ${on ? "text-white/80" : "text-ink-3"}`}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* The tile licence requires the attribution to be visible, and its own
            corner is where the search field lands — so it is given a box that
            stops short of the field rather than sitting underneath it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[30px] top-0">
          <MapCredit />
        </div>

        {/* Results, over the map rather than over the page: the map is the
            context the traveller is choosing inside. */}
        {searching && hits.length > 0 && (
          <div className="rm-in absolute inset-x-4 bottom-[52px] z-30 overflow-hidden rounded-2xl bg-bg shadow-[0_6px_24px_rgba(0,0,0,.18)]">
            {hits.map(({ a, metres }) => (
              <button
                key={a.id}
                onClick={() => select(a.id)}
                className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 active:bg-surface"
              >
                <PoiImage
                  poi={a.poi}
                  height={40}
                  radius={10}
                  emoji={false}
                  className="w-[52px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">
                    {a.poi.name}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {a.poi.area}
                  </span>
                </span>
                <span className="num shrink-0 text-[12.5px] text-ink-3">
                  {km(metres)}
                </span>
              </button>
            ))}
            <button
              onClick={() => nav.go({ k: "search", q })}
              className="w-full px-4 py-3 text-left text-[13px] font-semibold text-ink-2 active:bg-surface"
            >
              在全部景點中搜尋「{q.trim()}」
            </button>
          </div>
        )}
      </div>

      {/* Straddling the edge: half the control is over the map and half over the
          page, which is what `pb-6` on the wrapper leaves room for. The wrapper
          is deliberately not `overflow-hidden` — the map is, and this has to be
          able to hang out of it. */}
      <div className="absolute inset-x-4 bottom-0 z-20 flex items-center gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-bg px-4 shadow-[0_4px_18px_rgba(0,0,0,.16)]">
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearching(true);
              /* A preview card and a list of search results are two answers to
                 the same question, and the card sits on top of the results. The
                 moment somebody starts typing they have moved on from it. */
              setPicked(null);
              setPickedOsm(null);
            }}
            onFocus={() => {
              setSearching(true);
              setPicked(null);
              setPickedOsm(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) nav.go({ k: "search", q });
            }}
            aria-label="搜尋附近景點"
            placeholder="搜尋景點"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
          />
          {q && (
            <button
              onClick={() => {
                setQ("");
                setSearching(false);
              }}
              aria-label="清除搜尋"
              className="shrink-0 text-[15px] text-ink-3"
            >
              ×
            </button>
          )}
        </label>

        {/* The only control that ever asks the browser for a position. */}
        <button
          onClick={onLocate}
          aria-label="定位到目前位置"
          aria-busy={locating}
          className={`grid size-12 shrink-0 place-items-center rounded-full bg-bg shadow-[0_4px_18px_rgba(0,0,0,.16)] transition active:bg-surface ${
            fix.real ? "text-[#2F6FED]" : "text-ink-2"
          }`}
        >
          <LocateIcon spinning={locating} />
        </button>
      </div>

      {/* The card. A `Sheet`, so it lands above the tab bar and behaves like
          every other bottom sheet in the app rather than being a second, nearly
          identical thing that slides up from somewhere else. */}
      <Sheet open={Boolean(chosen)} onClose={() => setPicked(null)}>
        {chosen && <PreviewCard attraction={chosen.a} metres={chosen.metres} />}
      </Sheet>

      {/* An OpenStreetMap place. It has a name and a position and nothing else —
          no photograph, no guide, no ResoMap record — so the sheet says that and
          offers the one thing it can genuinely do. */}
      <Sheet open={Boolean(pickedOsm)} onClose={() => setPickedOsm(null)}>
        {pickedOsm && (
          <div className="px-5 pb-5 pt-1">
            <h2 className="text-[19px] font-bold leading-snug text-ink">
              {pickedOsm.name}
            </h2>
            <div className="num mt-1.5 text-[12.5px] text-ink-3">
              {km(distance(fix.at, pickedOsm.at))} · 來自 OpenStreetMap
            </div>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">
              這個地點還沒有 ResoMap 的語音導覽。
            </p>
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() =>
                  openPlaceDirections({
                    name: pickedOsm.name,
                    area: "",
                    lat: pickedOsm.at.lat,
                    lng: pickedOsm.at.lng,
                  })
                }
              >
                導航前往
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* A real restaurant or place to stay. Named for what it is, with where
          the data came from and the plain fact that ResoMap has no arrangement
          with it — then the four things the traveller can do. */}
      <Sheet
        open={Boolean(pickedPlace) && !adding}
        onClose={() => {
          setPickedPlace(null);
          setChoosingTrip(false);
        }}
      >
        {pickedPlace && (
          <PlaceCard
            place={pickedPlace}
            metres={distance(fix.at, pickedPlace)}
            saved={saved.places.some((x) => x.id === pickedPlace.id)}
            trips={nav.trips}
            choosingTrip={choosingTrip}
            onAdd={() => {
              if (nav.trips.length === 0) {
                setToast("還沒有行程。先到「行程」建立一個，再把這裡加進去。");
                return;
              }
              if (nav.trips.length === 1) setAdding({ place: pickedPlace, trip: nav.trips[0] });
              else setChoosingTrip(true);
            }}
            onPickTrip={(trip) => {
              setChoosingTrip(false);
              setAdding({ place: pickedPlace, trip });
            }}
          />
        )}
      </Sheet>

      {adding && adding.trip.days.length > 0 && (
        <AddToTrip
          target={{ kind: "place", place: adding.place }}
          trip={adding.trip}
          onClose={() => {
            setAdding(null);
            setPickedPlace(null);
          }}
        />
      )}

      {toast && (
        <div className="rm-in pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-6">
          <span className="rounded-2xl bg-ink px-4 py-2.5 text-center text-[13px] font-semibold leading-relaxed text-white">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * One place, and two things to do with it.
 *
 * Six lines: picture, name, distance, that there is a guide, one sentence, and
 * the buttons. Opening hours, category, the full description and everything else
 * is one tap away on the POI page — a preview that shows everything is not a
 * preview, it is the page with the map still visible behind it.
 */
function PreviewCard({
  attraction,
  metres,
}: {
  attraction: Attraction;
  metres: number;
}) {
  const nav = useNav();
  const p = attraction.poi;
  const count = attraction.audioCount;

  return (
    <div className="px-5 pb-4 pt-1">
      {/* eager: this is the one image on screen the traveller is waiting for. */}
      <PoiImage poi={p} height={168} radius={16} emoji={false} className="w-full" />

      <h2 className="mt-3 text-[19px] font-bold leading-snug text-ink">{p.name}</h2>

      <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-3">
        <span className="num shrink-0">{km(metres)}</span>
        <span aria-hidden>·</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-wash px-1.5 py-0.5 font-semibold text-brand">
          <Headphones size={11} />
          有語音導覽
        </span>
        {count > 1 && <span className="num shrink-0">{count} 則</span>}
      </div>

      <p className="mt-2.5 line-clamp-2 text-[14px] leading-relaxed text-ink-2">
        {oneLine(p)}
      </p>

      <div className="mt-4">
        <Button
          onClick={() => {
            /* Straight into the app's one player, on this place's own guide.
               Not a second player, and not a stub — every one of the seven has
               a recorded guide in data/stories.ts.

               The 30-second edit, not the full one, because the button says
               試聽. Everywhere else in the app that word opens the short cut —
               導覽庫's cards say 試聽 30 秒 and play "short" — and a 試聽 that
               starts a two-minute recording on somebody standing at a map pin
               is the label disagreeing with the thing it starts. The full
               version is one tap further in, on the place's own page. */
            const first = audiosFor(p.id)[0];
            if (p.storyId) nav.play(p.id, "short");
            else if (first) nav.playAudio(first.id);
          }}
        >
          試聽語音導覽
        </Button>
      </div>
      <div className="mt-1">
        <Button variant="ghost" onClick={() => nav.go({ k: "poi", id: p.id })}>
          查看景點詳細
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-ink-3"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A crosshair, which is what every map app uses for "find me".
 *
 * While it is working the ring pulses rather than a spinner being swapped in:
 * the control keeps its shape, so nothing on the row moves, and the animation
 * says "working" without claiming to know how long it will take.
 */
function LocateIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden
      className={spinning ? "animate-pulse" : ""}
    >
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="7.4" />
      <path d="M12 1.6v3.2M12 19.2v3.2M22.4 12h-3.2M4.8 12H1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The temperature where the blue dot is.
 *
 * The one live number in the app, and it earns the caption's last few pixels
 * because it is the only thing on this screen that changes while you look at
 * it. Everything else here is data that shipped with the build.
 *
 * It renders nothing at all until there is an answer, and nothing at all if
 * the answer never comes — no skeleton, no dash, no 25°. The caption is
 * complete without it, so its absence costs the reader nothing, and a
 * placeholder temperature would cost them the one thing this number has:
 * being true.
 */
function Sky() {
  const fix = useHere();
  const now = useNow(fix.at);
  const look = now ? describe(now.code, now.isDay) : null;
  if (!now || !look) return null;
  return (
    <>
      <span className="text-ink-3" aria-hidden>
        ·
      </span>
      <span className="shrink-0" aria-hidden>
        {look.icon}
      </span>
      <span className="num shrink-0">{Math.round(now.tempC)}°</span>
    </>
  );
}

/* ------------------------------------------------- V3 round 2: 餐廳・住宿 */

type Filter = "all" | "sight" | "food" | "stay";

const FILTERS: { id: Filter; label: string; dot?: string }[] = [
  { id: "all", label: "全部" },
  { id: "sight", label: "景點", dot: "#ff6210" },
  { id: "food", label: "餐廳", dot: PLACE_PIN.food.color },
  { id: "stay", label: "住宿", dot: PLACE_PIN.stay.color },
];

/** The snapshot, when the traveller is standing near where it was taken. */
function snapshotNear(at: LatLng): { food: PlaceRef[]; stay: PlaceRef[] } {
  return distance(at, OSM_SNAPSHOT.at) < 3000 ? OSM_SNAPSHOT : { food: [], stay: [] };
}

/**
 * Which of the places to draw: nearest first, one per name (a chain with four
 * branches in view is one answer, not four pins), and never on top of the
 * blue dot — a pin sitting on "you are here" hides the one thing the map
 * must always show.
 */
function pickPlaces(at: LatLng, all: { food: PlaceRef[]; stay: PlaceRef[] }) {
  const choose = (list: PlaceRef[], radius: number, cap: number) => {
    const seen = new Set<string>();
    return list
      .map((p) => ({ p, m: distance(at, p) }))
      .filter(({ m }) => m > 60 && m <= radius)
      .sort((a, b) => a.m - b.m)
      .filter(({ p }) => (seen.has(p.name) ? false : (seen.add(p.name), true)))
      .slice(0, cap)
      .map(({ p }) => p);
  };
  return { food: choose(all.food, 1200, 12), stay: choose(all.stay, 3000, 8) };
}

function placePin(p: PlaceRef, picked: PlaceRef | null): MapPin {
  return {
    poi: { id: p.id, name: p.name, area: p.sub ?? "", lat: p.lat, lng: p.lng, emoji: "", tint: "" },
    place: p.cat === "stay" ? "stay" : "food",
    selected: picked?.id === p.id,
  };
}

function PlaceCard({
  place,
  metres,
  saved,
  trips,
  choosingTrip,
  onAdd,
  onPickTrip,
}: {
  place: PlaceRef;
  metres: number;
  saved: boolean;
  trips: Trip[];
  choosingTrip: boolean;
  onAdd: () => void;
  onPickTrip: (t: Trip) => void;
}) {
  const kind = place.cat === "stay" ? "stay" : "food";
  const color = PLACE_PIN[kind].color;

  return (
    <div className="px-5 pb-5 pt-1">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full text-[19px] text-white"
          style={{ background: color }}
          aria-hidden
        >
          {kind === "stay" ? "🛏" : "🍴"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-bold leading-snug text-ink">{place.name}</h2>
          <div className="num mt-1 text-[13px] text-ink-3">
            {place.sub || (kind === "stay" ? "住宿" : "餐廳")} · {km(metres)}
          </div>
        </div>
        <button
          onClick={() => togglePlace(place)}
          aria-label={saved ? "取消收藏" : "收藏"}
          aria-pressed={saved}
          className={`grid size-11 shrink-0 place-items-center rounded-full text-[20px] active:bg-surface ${
            saved ? "text-brand" : "text-ink-3"
          }`}
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>

      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-3">
        資料：OpenStreetMap。這是一般店家，不是 ResoMap 的合作商家，營業時間與價格請以店家為準。
      </p>

      {choosingTrip ? (
        <div className="mt-4">
          <div className="text-[13px] font-semibold text-ink-3">加到哪一趟？</div>
          <div className="mt-2 space-y-2">
            {trips.map((t) => (
              <button
                key={t.id}
                onClick={() => onPickTrip(t)}
                className="flex min-h-12 w-full items-center gap-2 rounded-2xl bg-surface px-4 text-left active:bg-surface-2"
              >
                <span className="flex-1 truncate text-[15px] font-semibold text-ink">{t.title}</span>
                <span className="num shrink-0 text-[12.5px] text-ink-3">{t.dates}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              openPlaceDirections({ name: place.name, area: "", lat: place.lat, lng: place.lng })
            }
          >
            導航
          </Button>
          <Button onClick={onAdd}>加入行程</Button>
        </div>
      )}

      {/* A hotel can be booked, so it gets the two platforms. Searched by its
          own name in their hotel category, carrying the affiliate ids. */}
      {kind === "stay" && !choosingTrip && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["klook", "kkday"] as const).map((pf) => (
            <a
              key={pf}
              href={searchUrl(pf, "hotel", place.name)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex min-h-12 items-center justify-center gap-1 rounded-2xl text-[14px] font-bold ring-1 ring-line active:bg-surface"
              style={{ color: pf === "klook" ? "#FF5B00" : "#1FA8B2" }}
            >
              在 {pf === "klook" ? "Klook" : "KKday"} 找這間 ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
