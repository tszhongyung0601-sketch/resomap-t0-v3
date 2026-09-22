import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { POIS, poisForDest } from "../data";
import { distance, km } from "../lib/geo";
import { lookupPlaceLink } from "../lib/placelink";
import { hasStory } from "../lib/story";
import { useNav } from "../nav";
import { Button, Row, Sheet, StoryBadge } from "../components/ui";
import { PoiThumb } from "../components/Cover";
import { POI_KIND_LABELS, type Poi, type Trip } from "../types";
import { poiOf, viewOf } from "../lib/stop";
import type { StopView } from "../lib/stop";

/**
 * Adding a place is a two-second job, so it stays a sheet over the day you are
 * looking at. Opening a full-screen search — losing the itinerary, adding, then
 * finding your way back to the same day — is how planners turn one decision
 * into four taps and a moment of "wait, where was I?".
 */
export function AddPoiSheet({
  tripId,
  day,
  onClose,
}: {
  tripId: string;
  day: number;
  onClose: () => void;
}) {
  const nav = useNav();
  const [q, setQ] = useState("");
  /* The live trip, not the static fixture. Reading BY_TRIP meant a trip created
     during the demo had no entry at all (the sheet was empty), and an existing
     one kept re-offering places you had just added. */
  const trip = nav.trips.find((t) => t.id === tripId);

  const { anchor, nearby, more } = useMemo<{
    /* Whatever the day currently ends at, which need not be a place. */
    anchor: StopView | null;
    nearby: Poi[];
    more: Poi[];
  }>(() => {
    if (!trip) return { anchor: null, nearby: [], more: [] };
    const pool = poisForDest(trip.destId);
    /* Places only. This screen offers places, so a hire car or a restaurant
       already in the itinerary is not something it could duplicate. */
    const inTrip = new Set(
      trip.days.flatMap((d) => d.tracks.flatMap((t) => t.stops.flatMap((s) => poiOf(s)?.id ?? []))),
    );
    const thisDay = new Set(
      trip.days
        .filter((d) => d.n === day)
        .flatMap((d) => d.tracks.flatMap((t) => t.stops.flatMap((s) => poiOf(s)?.id ?? []))),
    );

    /* Where this day currently ends — the exact stop a new place is appended
       after. Ranking from there is what lets the list say 附近 and mean it;
       "nearby" measured from nothing is just the dataset's original order. */
    const target = trip.days.find((d) => d.n === day);
    const lastTrack = target?.tracks[target.tracks.length - 1];
    const lastStop = lastTrack?.stops[lastTrack.stops.length - 1];
    /* Any last stop will do as an anchor — a hire car counter is a perfectly
       good place to measure 附近 from. Only its coordinates are needed. */
    const anchor = lastStop ? (viewOf(lastStop) ?? null) : null;

    /* Prefer places the trip has not used at all; a short demo city can run out
       of those, and an empty section is worse than one offering a place that is
       planned for another day. Never offer something already on THIS day —
       tapping it would append a duplicate stop. */
    const unused = pool.filter((p) => !inTrip.has(p.id));
    const base = unused.length > 0 ? unused : pool.filter((p) => !thisDay.has(p.id));
    const ranked = anchor
      ? [...base].sort((a, b) => distance(anchor, a) - distance(anchor, b))
      : base;

    return { anchor, nearby: ranked.slice(0, 5), more: ranked.slice(5, 8) };
  }, [trip, day]);

  const results = useMemo<Poi[]>(() => {
    const k = q.trim();
    if (!k) return [];
    const hits = POIS.filter((p) => p.name.includes(k) || p.area.includes(k));
    /* Somewhere in the city you are already in is almost always the answer. */
    const here = trip?.destId;
    return [
      ...hits.filter((p) => p.destId === here),
      ...hits.filter((p) => p.destId !== here),
    ].slice(0, 8);
  }, [q, trip]);

  if (!trip) return null;

  const add = (poiId: string) => {
    nav.addStop(tripId, day, { kind: "poi", poiId });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="加入景點">
      <PasteLink trip={trip} day={day} onAdded={onClose} />

      <div className="px-5 pb-1 pt-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋地點或區域"
          className="h-11 w-full rounded-full bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {q.trim() ? (
        <Group title="搜尋結果">
          {results.length > 0 ? (
            results.map((p) => <PoiRow key={p.id} poi={p} onClick={() => add(p.id)} />)
          ) : (
            <p className="px-5 py-3 text-[13.5px] text-ink-3">
              找不到符合的地點，換個關鍵字或直接從地圖挑。
            </p>
          )}
        </Group>
      ) : (
        <>
          {nearby.length > 0 && (
            <Group title={anchor ? "附近推薦" : "可以加進這天的地方"}>
              {nearby.map((p) => (
                <PoiRow
                  key={p.id}
                  poi={p}
                  metres={anchor ? distance(anchor, p) : undefined}
                  onClick={() => add(p.id)}
                />
              ))}
            </Group>
          )}

          {more.length > 0 && (
            <Group title="其他地方">
              {more.map((p) => (
                <PoiRow key={p.id} poi={p} onClick={() => add(p.id)} />
              ))}
            </Group>
          )}
        </>
      )}

      <Group title="從地圖選擇">
        <Row
          icon="🗺️"
          label="在地圖上挑一個地方"
          onClick={() => {
            onClose();
            nav.go({ k: "tripmap", tripId, n: day });
          }}
        />
      </Group>
    </Sheet>
  );
}

/* ------------------------------------------------------ paste a Google link */

/**
 * Paste a Google Maps link, get the place.
 *
 * Everything happens on the string. There is no backend and the browser cannot
 * fetch google.com, so the only links that can work are the long ones a desktop
 * Google Maps produces — and the phone's share sheet produces short ones. Rather
 * than failing quietly on the most common input, each outcome says exactly what
 * happened, including what name the app managed to read. A traveller who can see
 * that it read 「台北車站」 knows the paste worked and the data does not have the
 * place; a blank result teaches them nothing.
 *
 * Nothing is added until 加入 is pressed, and the day is theirs to pick. The old
 * flow appended to whichever day the sheet was opened on, which is right when you
 * tapped ＋ on that day and wrong when you arrive holding a link for a place you
 * meant to visit on Thursday.
 */
function PasteLink({
  trip,
  day,
  onAdded,
}: {
  trip: Trip;
  day: number;
  onAdded: () => void;
}) {
  const nav = useNav();
  const [text, setText] = useState("");
  const [pick, setPick] = useState(day);

  const found = useMemo(() => (text.trim() ? lookupPlaceLink(text) : null), [text]);
  const already = useMemo(() => {
    if (found?.kind !== "found") return false;
    const onDay = trip.days.find((d) => d.n === pick);
    return Boolean(
      onDay?.tracks.some((t) => t.stops.some((s) => poiOf(s)?.id === found.poi.id)),
    );
  }, [found, trip, pick]);

  return (
    <div className="px-5 pt-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="貼上 Google 地圖連結"
        inputMode="url"
        autoComplete="off"
        className="h-11 w-full rounded-full bg-surface px-4 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />

      {found?.kind === "short" && (
        <Note>
          這種短連結需要連網才解得開。請在電腦版 Google 地圖複製網址，或直接輸入景點名稱。
        </Note>
      )}

      {found?.kind === "unknown" && (
        <Note>看不出這是哪個地方。可以貼 Google 地圖的網址，或直接輸入景點名稱。</Note>
      )}

      {found?.kind === "not-in-data" && (
        <Note>
          讀到「{found.name}」，但這個地方還不在 ResoMap 的資料裡。
        </Note>
      )}

      {found?.kind === "found" && (
        <div className="mt-2.5 rounded-2xl bg-surface p-3.5">
          <div className="flex items-center gap-3">
            <PoiThumb poi={found.poi} size={44} radius={12} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold text-ink">
                  {found.poi.name}
                </span>
                {hasStory(found.poi.id) && <StoryBadge label={false} />}
              </div>
              <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                {found.poi.area} · {POI_KIND_LABELS[found.poi.kind]} · 建議停留{" "}
                {found.poi.stayMin} 分
              </div>
            </div>
          </div>

          {/* One chip per day the trip actually has — never a fixed seven. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trip.days.map((d) => (
              <button
                key={d.n}
                onClick={() => setPick(d.n)}
                className={`min-h-11 rounded-full px-3 text-[13px] font-semibold transition ${
                  d.n === pick ? "bg-brand text-white" : "bg-bg text-ink-2 active:bg-surface-2"
                }`}
              >
                Day {d.n}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <Button
              variant="onCard"
              disabled={already}
              onClick={() => {
                nav.addStop(trip.id, pick, { kind: "poi", poiId: found.poi.id });
                setText("");
                onAdded();
              }}
            >
              {already ? `Day ${pick} 已經有這個地點` : `加入 Day ${pick}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The one-line answer under the field. Never phrased as the traveller's fault. */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-ink-2">{children}</p>
  );
}

/** `metres` is only passed where it was actually measured from somewhere. */
function PoiRow({
  poi: p,
  metres,
  onClick,
}: {
  poi: Poi;
  metres?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-surface"
    >
      <PoiThumb poi={p} size={44} radius={12} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink">{p.name}</div>
        <div className="truncate text-[12.5px] text-ink-3">
          {p.area} · {POI_KIND_LABELS[p.kind]}
          {metres === undefined ? "" : ` · ${km(metres)}`}
        </div>
      </div>
      <span className="shrink-0 text-[19px] text-ink-3">＋</span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="px-5 pb-1 text-[13px] font-semibold text-ink-3">{title}</h3>
      {children}
    </section>
  );
}
