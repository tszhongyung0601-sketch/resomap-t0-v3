import { useEffect, useMemo, useState } from "react";
import { BY_DEST, DESTINATIONS, POIS, REGIONS } from "../data";
import { MapCredit, MapView, type MapPin } from "../components/MapView";
import { Chip, Empty, Segmented, StoryBadge, Thumb, TopBar } from "../components/ui";
import { PoiThumb } from "../components/Cover";
import { track } from "../lib/track";
import { useNav } from "../nav";
import { POI_KIND_LABELS, type Poi } from "../types";

/**
 * Results, then a map — never the other way round.
 *
 * A map answers "where is it"; a list answers "is it what I meant". Someone who
 * has just typed 台南 has not asked the first question yet, and opening onto a
 * full-bleed map makes them pan around to find out whether the search even
 * worked. So the list leads, and the map is one tap away for the moment it
 * starts being the better answer.
 */

type Mode = "list" | "map";
type Filter = "all" | "sights" | "food" | "story" | "events";

const MODES: { id: Mode; label: string }[] = [
  { id: "list", label: "清單" },
  { id: "map", label: "地圖" },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "sights", label: "景點" },
  { id: "food", label: "美食" },
  { id: "story", label: "故事" },
  { id: "events", label: "活動" },
];

/** A destination or a region the query named outright. */
interface Place {
  key: string;
  name: string;
  sub: string;
  emoji: string;
  tint: string;
  destId: string;
}

function passes(p: Poi, f: Filter) {
  if (f === "all") return true;
  if (f === "sights") return p.kind === "attraction" || p.kind === "nature";
  if (f === "food") return p.kind === "food";
  if (f === "story") return Boolean(p.storyId);
  return p.kind === "activity" || p.kind === "shopping";
}

/**
 * People type phrases, not keys: "台南兩天", "宜蘭親子", "東京賞櫻". Matching only
 * one direction fails all three — 台南 does not contain 台南兩天 — so a place
 * matches when either string contains the other.
 *
 * Takes `query` as an argument rather than closing over it, which is what lets
 * the memos below depend on `[query]` alone instead of suppressing the hook
 * dependency rule. Callers guard against an empty query: every name contains
 * "", so an unguarded blank search would match the entire dataset.
 */
function named(name: string, query: string) {
  const n = name.toLowerCase();
  return n.includes(query) || query.includes(n);
}

export function Search({ q }: { q: string }) {
  const nav = useNav();
  const [text, setText] = useState(q);
  const [mode, setMode] = useState<Mode>("list");
  const [filter, setFilter] = useState<Filter>("all");

  const query = text.trim().toLowerCase();

  /* A second search pushed from elsewhere reuses this screen, so the field has
     to follow the route rather than keep whatever was typed last time. */
  useEffect(() => setText(q), [q]);

  /* One event per search, not one per keystroke. Firing on every change logged
     台, 台南, 台南美 and 台南美食 as four separate searches, which is a count
     nobody performed — and the event log is capped, so padding it with three
     phantom rows evicts the affiliate events the business screen reads. */
  useEffect(() => {
    if (!query) return;
    const t = window.setTimeout(() => track("search"), 600);
    return () => window.clearTimeout(t);
  }, [query]);

  /* A city name is the most common thing anyone types, so it has to match the
     city itself and everything in it — not just the places whose own name
     happens to contain it. */
  const results = useMemo(() => {
    if (!query) return [];
    return POIS.filter((p) => {
      const city = BY_DEST[p.destId]?.name ?? "";
      const hit =
        p.name.toLowerCase().includes(query) ||
        p.area.toLowerCase().includes(query) ||
        (p.about?.toLowerCase().includes(query) ?? false) ||
        named(city, query);
      return hit && passes(p, filter);
    });
  }, [query, filter]);

  const places = useMemo<Place[]>(() => {
    if (!query) return [];
    const out: Place[] = [];
    for (const d of DESTINATIONS) {
      if (named(d.name, query)) {
        out.push({
          key: d.id,
          name: d.name,
          sub: d.tagline,
          emoji: d.emoji,
          tint: d.tint,
          destId: d.id,
        });
      }
    }
    for (const r of REGIONS) {
      if (!named(r.name, query)) continue;
      /* Regions have no page of their own; they open the city they hang off,
         and the row says which one so the jump is never a surprise. */
      const near = DESTINATIONS.find((d) => d.name === r.near);
      if (!near) continue;
      out.push({
        key: r.id,
        name: r.name,
        sub: `${r.near} · ${r.tagline}`,
        emoji: r.emoji,
        tint: r.tint,
        destId: near.id,
      });
    }
    return out.slice(0, 3);
  }, [query]);

  /* MapView re-frames itself whenever the identity of `pins` changes. Building
     the array inline handed it a fresh one on every render, so each keystroke
     in the field above snapped the map back and undid the traveller's own
     panning. Tied to `results`, it re-fits only when the results really move. */
  const pins = useMemo<MapPin[]>(() => results.map((p) => ({ poi: p })), [results]);

  const centre: [number, number] = results[0]
    ? [results[0].lat, results[0].lng]
    : [23.7, 121.0];

  /* Takes the id and nothing else, so the same handler serves a result row
     and a map pin without either having to be a full Poi. */
  const openPoi = (p: { id: string }) => nav.go({ k: "poi", id: p.id });
  const nothing = Boolean(query) && !results.length && !places.length;

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar
        onBack={nav.back}
        right={<Segmented items={MODES} value={mode} onChange={setMode} />}
        below={
          <>
            <div className="px-4">
              {/* py-2 rather than py-3: the clear button below is a full 44px
                  touch target, so the field keeps its original 60px height
                  without shrinking the thing you have to hit. */}
              <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-2">
                <Glass />
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="搜尋城市、景點或想做的事情"
                  className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
                />
                {text && (
                  <button
                    onClick={() => setText("")}
                    aria-label="清除"
                    className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-[13px] text-ink-3 active:bg-surface-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
              {FILTERS.map((f) => (
                <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </>
        }
      />

      {mode === "list" ? (
        <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          {!query && <Empty icon="🧭" text="輸入城市、景點，或你想吃的東西" />}

          {nothing && <Empty icon="🔍" text={`找不到「${text.trim()}」的結果，換個關鍵字試試`} />}

          {places.length > 0 && (
            <div className="px-5 pt-2">
              {places.map((pl) => (
                <button
                  key={pl.key}
                  onClick={() => nav.go({ k: "dest", id: pl.destId })}
                  className="flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-0 active:bg-surface"
                >
                  <Thumb emoji={pl.emoji} tint={pl.tint} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-ink">
                      前往{pl.name}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{pl.sub}</div>
                  </div>
                  <span className="shrink-0 text-[15px] text-ink-3">›</span>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="num px-5 pb-1 pt-4 text-[12px] text-ink-3">
                {results.length} 個地點
              </div>
              <div className="px-5">
                {results.map((p) => (
                  <PoiRow key={p.id} poi={p} onClick={() => openPoi(p)} />
                ))}
              </div>
            </>
          )}

          <div className="h-24 shrink-0" />
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <MapView pins={pins} centre={centre} fit onPick={openPoi} />

          <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-bg pb-6 pt-2.5">
            <div className="mx-auto h-1 w-9 rounded-full bg-line" />
            <div className="mt-2.5 px-5 text-[15px] font-bold text-ink">搜尋結果</div>
            <div className="mt-1 max-h-[264px] overflow-y-auto px-5 no-scrollbar">
              {results.length ? (
                results.slice(0, 4).map((p) => (
                  <PoiRow key={p.id} poi={p} compact onClick={() => openPoi(p)} />
                ))
              ) : (
                <p className="py-4 text-[13.5px] text-ink-3">沒有符合的地點，換個關鍵字試試</p>
              )}
            </div>
            <MapCredit />
          </div>
        </div>
      )}
    </div>
  );
}

function PoiRow({
  poi,
  compact,
  onClick,
}: {
  poi: Poi;
  compact?: boolean;
  onClick: () => void;
}) {
  const city = BY_DEST[poi.destId]?.name;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-line text-left last:border-0 active:bg-surface ${
        compact ? "py-2.5" : "py-3"
      }`}
    >
      <PoiThumb poi={poi} size={compact ? 44 : 52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14.5px] font-semibold text-ink">{poi.name}</span>
          {poi.storyId && <StoryBadge label={false} />}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
          {city ? `${city} · ` : ""}
          {poi.area} · {POI_KIND_LABELS[poi.kind]}
        </div>
      </div>
      <span className="shrink-0 text-[15px] text-ink-3">›</span>
    </button>
  );
}

function Glass() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#918c83"
      strokeWidth="2"
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" strokeLinecap="round" />
    </svg>
  );
}
