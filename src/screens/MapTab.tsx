import { useMemo, useState } from "react";
import { MapCredit, MapView, PinLegend, type MapPin } from "../components/MapView";
import { Button, Card, Chip, Sheet, StoryBadge, Tag } from "../components/ui";
import { PoiThumb } from "../components/Cover";
import { DEALS, POIS, TW_DESTINATIONS, dest, poisForDest } from "../data";
import { distance, km } from "../lib/geo";
import { audioCount, hasAudio } from "../lib/audio";
import { useNav } from "../nav";
import type { Poi } from "../types";

/**
 * The map tab.
 *
 * One job: find something near where you are looking. Everything that is not
 * that — accommodation, tickets, coupons, merchants — lives behind 更多篩選
 * rather than in a twelve-chip rail nobody can read while walking.
 */

type Filter = "all" | "sight" | "food" | "story" | "activity";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "sight", label: "景點" },
  { id: "food", label: "美食" },
  { id: "story", label: "故事" },
  { id: "activity", label: "活動" },
];

/** Second level. No merchant supply exists yet, so none of it can filter. */
const LATER: { icon: string; label: string }[] = [
  { icon: "🛏️", label: "住宿" },
  { icon: "🎫", label: "門票" },
  { icon: "🏷️", label: "優惠" },
  { icon: "🏪", label: "商家" },
];

/** Roughly the centre of the island, framed so the whole of Taiwan fits. */
const TW_CENTRE = { lat: 23.75, lng: 120.95 };
const TW_ZOOM = 7;

const TW_DEST_IDS = new Set(TW_DESTINATIONS.map((d) => d.id));

function matches(p: Poi, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    /* 自然 has no chip of its own; a gorge and a fort are both "somewhere to go"
       to a traveller, and splitting them would leave half the map unreachable. */
    case "sight":
      return p.kind === "attraction" || p.kind === "nature";
    case "food":
      return p.kind === "food";
    case "story":
      return Boolean(p.storyId);
    case "activity":
      return p.kind === "activity";
  }
}

/**
 * Paid placement is a property of the deal, not of the place.
 *
 * Only a POI that a sponsored deal actually names can carry the label. A
 * campaign bought at destination level buys a promoted slot in that
 * destination's deal list; it does not buy a 贊助 badge on an unrelated temple
 * that happens to sit in the same city. Attributing it that way would put a
 * paid label on an organic result and push that result to the top under it,
 * which is precisely the thing the label exists to prevent.
 *
 * The named POI is hoisted to the top, so the label is literally true: that row
 * is where it is because someone paid for it. With the current demo inventory
 * no sponsored deal names a POI, so the map shows no paid row — that is the
 * honest outcome, not a gap to be filled.
 */
function sponsoredIn(list: Poi[]): string | null {
  const paid = DEALS.filter((d) => d.sponsored && d.poiId);
  return list.find((p) => paid.some((d) => d.poiId === p.id))?.id ?? null;
}

export function MapTab({ destId }: { destId: string | null }) {
  const nav = useNav();
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const here = destId ? dest(destId) : undefined;
  const centre = useMemo(
    () => (here ? { lat: here.lat, lng: here.lng } : TW_CENTRE),
    [here],
  );

  const shown = useMemo(() => {
    const scope = here
      ? poisForDest(here.id)
      : POIS.filter((p) => TW_DEST_IDS.has(p.destId));
    return scope.filter((p) => p.kind !== "transit" && matches(p, filter));
  }, [here, filter]);

  /* Nearest five to whatever the map is centred on, with the promoted slot
     first. Five is what fits without the sheet needing to be dragged. */
  const { nearby, paidId } = useMemo(() => {
    const sorted = [...shown]
      .sort((a, b) => distance(centre, a) - distance(centre, b))
      .slice(0, 5);
    const paid = sponsoredIn(sorted);
    if (!paid) return { nearby: sorted, paidId: null };
    return {
      nearby: [
        ...sorted.filter((p) => p.id === paid),
        ...sorted.filter((p) => p.id !== paid),
      ],
      paidId: paid,
    };
  }, [shown, centre]);

  /* Two pin colours, the same two the home screen uses — but read off
     `hasAudio` rather than `hasStory`. The home map asks "did ResoMap record
     here", which is what its own legend promises. This map is the one you open
     while standing somewhere, and the question there is whether there is
     anything at all to listen to: 饒河街 has six guides and no ResoMap
     recording, and a navy pin on it would be false. */
  const pins: MapPin[] = useMemo(
    () =>
      shown.map((p) => ({
        poi: p,
        sponsored: p.id === paidId,
        tone: hasAudio(p.id) ? ("story" as const) : ("plain" as const),
      })),
    [shown, paidId],
  );

  /* Resolved against what is currently on the map rather than the global index,
     so a selection cannot outlive the thing that produced it — changing
     destination remounts the map but leaves this state untouched, and looking
     the id up globally would strand a card for a place no longer shown. */
  const active = activeId ? shown.find((p) => p.id === activeId) : undefined;
  const label = FILTERS.find((f) => f.id === filter)?.label ?? "地點";
  /* Not "附近推薦" — that is the floating AI button's job, and a panel wearing
     the same label as the button above it makes both look broken. This list is
     just what is on the map right now. */
  const heading = active ? active.name : here ? `${here.name}這一帶` : "台灣各地";

  /* Measured from the destination's own centre — which is what `centre` holds.
     Not from the viewport (the map pans freely and nothing reports that back)
     and not from the traveller (the app never asks for geolocation), so it is
     labelled with the place it is genuinely measured from. Across the whole
     island there is no such reference point, and a distance from the centroid
     of Taiwan tells a traveller nothing, so none is shown. */
  /* "距花蓮 535 m" reads as nonsense when you are already in 花蓮. The centre of
     the map is the reference, so say that. */
  const away = (p: Poi) => (here ? `距地圖中心 ${km(distance(centre, p))}` : null);

  function pick(f: Filter) {
    setFilter(f);
    setActiveId(null);
  }

  return (
    <div className="relative h-full">
      <MapView
        key={here?.id ?? "tw"}
        pins={pins}
        centre={[centre.lat, centre.lng]}
        zoom={here?.zoom ?? TW_ZOOM}
        activeId={activeId}
        onPick={(p) => setActiveId(p.id)}
      />

      {/* Two colours with no key is decoration pretending to be data. It sits
          below the filter row so it never covers a control. */}
      <div className="pointer-events-none absolute inset-x-0 top-[104px] z-10 h-0">
        <PinLegend on="有語音導覽" off="還沒有" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4">
        <button
          onClick={() => nav.go({ k: "search", q: "" })}
          className="pointer-events-auto flex w-full items-center gap-2.5 rounded-full bg-bg px-4 py-3 text-left shadow-[0_2px_12px_rgba(0,0,0,.1)] active:bg-surface"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#918c83" strokeWidth="2">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" strokeLinecap="round" />
          </svg>
          <span className="truncate text-[14px] text-ink-3">
            搜尋{here ? `${here.name}的景點、美食` : "地點、城市"}
          </span>
        </button>

        <div className="pointer-events-auto mt-2.5 flex items-center gap-2">
          {/* The mask makes the overflowing chip fade rather than get sliced in
              half, so a scrollable row reads as scrollable and not as a bug. */}
          <div
            className="flex flex-1 gap-2 overflow-x-auto no-scrollbar"
            style={{
              maskImage: "linear-gradient(to right, #000 88%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, #000 88%, transparent)",
            }}
          >
            {FILTERS.map((f) => (
              <Chip key={f.id} active={filter === f.id} onClick={() => pick(f.id)}>
                {f.label}
              </Chip>
            ))}
            <span className="w-2 shrink-0" />
          </div>
          <Chip onClick={() => setMore(true)}>更多</Chip>
        </div>
      </div>

      {/* pb clears the tab bar exactly — any more reads as a dead white band. */}
      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-bg pb-[76px] pt-2.5">
        <div className="mx-auto h-1 w-9 rounded-full bg-line" />

        <div className="mt-2.5 flex items-center gap-2 px-5">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">
            {heading}
          </h2>
          {active && (
            <button
              onClick={() => setActiveId(null)}
              aria-label="取消選取"
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-[17px] text-ink-3 active:bg-surface"
            >
              ×
            </button>
          )}
        </div>

        {active ? (
          <div className="px-5 pb-4 pt-2.5">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <PoiThumb poi={active} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold text-ink">
                      {active.name}
                    </span>
                    {hasAudio(active.id) && (
                      <StoryBadge minutes={undefined} label={false} />
                    )}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-ink-3">
                    {[
                      active.area,
                      away(active),
                      audioCount(active.id) ? `${audioCount(active.id)} 則語音` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
              {/* `onCard`, not `primary`. The floating AI button is already a
                  filled orange pill sitting over the bottom of this panel; a
                  second full-width orange button 60px from it makes the map
                  read as two competing calls to action instead of one place
                  you tapped. On a bg-surface Card the page-white fill is the
                  variant that stays visible without shouting. */}
              {/* 查看 opens the place; 探索附近 opens what is around it. Both
                  `onCard`, because on a bg-surface card the page-white fill is
                  the variant that stays visible without turning the map into
                  two competing calls to action. */}
              <div className="mt-3.5 flex gap-2">
                <Button
                  variant="onCard"
                  onClick={() => nav.go({ k: "poi", id: active.id })}
                >
                  查看
                </Button>
                <Button
                  variant="onCard"
                  onClick={() => nav.go({ k: "nearby", poiId: active.id })}
                >
                  探索附近
                </Button>
              </div>
            </Card>
          </div>
        ) : nearby.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-ink-3">
            這個範圍還沒有{label === "全部" ? "地點" : label}。
          </p>
        ) : (
          /* Four rows visible, the fifth a short scroll away. The floating AI
             button sits over the bottom of this panel, so the list carries
             enough trailing padding for its last row to be scrolled clear of
             it — the same thing Apple Maps does with its own bottom sheet. */
          <div className="mt-1 max-h-[266px] overflow-y-auto px-5 pb-14 no-scrollbar">
            {nearby.map((p) => (
              <button
                key={p.id}
                onClick={() => nav.go({ k: "poi", id: p.id })}
                className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0 active:bg-surface"
              >
                <PoiThumb poi={p} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-ink">
                      {p.name}
                    </span>
                    {hasAudio(p.id) && <StoryBadge label={false} />}
                    {p.id === paidId && <Tag kind="sponsored" />}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-ink-3">
                    {[p.area, away(p)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="shrink-0 text-ink-3">›</span>
              </button>
            ))}
          </div>
        )}

        {/* Inside the panel, not over the map. The tile licence requires the
            attribution to be visible, and at z-10 under this z-20 sheet it was
            not: the sheet is pinned to the same bottom edge and covers it
            completely. Here it lands in the panel's own bottom padding — the
            same place the search map puts it. */}
        <MapCredit />
      </div>

      <Sheet open={more} onClose={() => setMore(false)} title="更多篩選">
        <p className="px-5 pb-1 text-[13px] leading-relaxed text-ink-3">
          這四項要等商家資料進來才能篩選，目前地圖上只有景點、美食與故事。
        </p>
        <ul className="px-5 pt-2">
          {LATER.map((f) => (
            <li
              key={f.label}
              className="flex items-center gap-3 border-b border-line py-3.5 last:border-0"
            >
              <span className="w-6 shrink-0 text-center text-[17px] opacity-45">
                {f.icon}
              </span>
              <span className="flex-1 text-[15px] text-ink-3">{f.label}</span>
              <Tag kind="later" />
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
