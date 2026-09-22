import { useEffect, useMemo, useState } from "react";
import { AFFILIATE_DISCLOSURE, BY_POI, dealsForDest, dest, poisForDest, story } from "../data";
import { DealCard } from "../components/DealCard";
import { Button, Empty, Note, Screen, Section, StoryBadge, Tabs } from "../components/ui";
import { PoiThumb } from "../components/Cover";
import { track } from "../lib/track";
import { useNav } from "../nav";
import {
  POI_KIND_LABELS,
  type Destination as DestinationRecord,
  type Poi,
} from "../types";

/**
 * A place, before it becomes a plan.
 *
 * Tapping 台南 does not start generating an itinerary. Someone who has just
 * heard of a city wants to know what is there — and someone who already knows
 * wants to find the one street they came for. Both of those are browsing, and
 * an AI that starts planning before either question is answered is answering a
 * question nobody asked. Planning is one button, at the bottom, when they are
 * ready.
 */

type TabId = "top" | "sights" | "food" | "story" | "events";

const TABS: { id: TabId; label: string }[] = [
  { id: "top", label: "推薦" },
  { id: "sights", label: "景點" },
  { id: "food", label: "美食" },
  { id: "story", label: "故事" },
  { id: "events", label: "活動" },
];

export function Destination({ id }: { id: string }) {
  const nav = useNav();
  const d = dest(id);

  useEffect(() => {
    track("destination_view", { destId: id });
  }, [id]);

  if (!d) {
    return (
      <Screen>
        <Empty
          icon="🧭"
          text="找不到這個目的地"
          action="回到探索"
          onAction={() => nav.tab("explore")}
        />
      </Screen>
    );
  }

  return <Body d={d} />;
}

function Body({ d }: { d: DestinationRecord }) {
  const nav = useNav();
  const [tab, setTab] = useState<TabId>("top");

  const pois = useMemo(() => poisForDest(d.id), [d.id]);
  const sights = useMemo(
    () => pois.filter((p) => p.kind === "attraction" || p.kind === "nature"),
    [pois],
  );
  const foods = useMemo(() => pois.filter((p) => p.kind === "food"), [pois]);
  const stories = useMemo(() => pois.filter((p) => p.storyId), [pois]);
  const events = useMemo(
    () => pois.filter((p) => p.kind === "activity" || p.kind === "shopping"),
    [pois],
  );
  /* A 門票 card may only ever appear for a venue that genuinely sells admission.
     The deal records honour that today, but this list is a plain destination
     slice rather than Poi.tsx's per-place lookup — so the rule is enforced here
     too, and a future record cannot quietly put a ticket on a free temple. */
  const deals = useMemo(
    () =>
      dealsForDest(d.id)
        .filter(
          (deal) =>
            deal.category !== "ticket" ||
            !deal.poiId ||
            Boolean(BY_POI[deal.poiId]?.ticketed),
        )
        .slice(0, 2),
    [d.id],
  );

  /* Suggested itineraries are written from this city's own places, so the
     preview names things that actually exist here rather than a stock blurb. */
  const plans = useMemo(() => {
    const out: { id: string; icon: string; title: string; sub: string }[] = [];
    if (sights.length >= 2) {
      out.push({
        id: "classic",
        icon: "🗓️",
        title: `${d.name}經典 2 日`,
        sub: sights.slice(0, 3).map((p) => p.name).join(" · "),
      });
    }
    if (foods.length >= 2) {
      out.push({
        id: "food",
        icon: "🍜",
        title: `${d.name}巷弄美食一日`,
        sub: foods.slice(0, 3).map((p) => p.name).join(" · "),
      });
    }
    return out;
  }, [d.name, sights, foods]);

  const openPoi = (p: Poi) => nav.go({ k: "poi", id: p.id });
  const plan = () => nav.go({ k: "create", destId: d.id });

  return (
    <Screen>
      <div
        className="relative grid h-[180px] shrink-0 place-items-center"
        style={{ background: d.tint }}
      >
        <span className="text-[64px] leading-none">{d.emoji}</span>
        <button
          onClick={nav.back}
          aria-label="返回"
          className="absolute left-4 top-4 grid size-11 place-items-center rounded-full bg-bg/90 text-[19px] text-ink active:bg-bg"
        >
          ‹
        </button>
        {/* There was a 地圖 button here. It called nav.tab("map"), and the map
            tab is framed on the traveller's own trip — so from 台南 it opened a
            map of 花蓮, and switching tabs cleared the stack so 返回 could not
            undo it. A button that goes to the wrong city is worse than no
            button; it comes back when there is a destination-scoped map route
            to send it to. */}
      </div>

      <div className="px-5 pb-4 pt-5">
        <h1 className="text-[24px] font-bold leading-tight text-ink">{d.name}</h1>
        <p className="mt-1 text-[14px] text-ink-3">{d.tagline}</p>
      </div>

      <div className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-1 backdrop-blur">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "top" && (
        <>
          {sights.length > 0 && (
            <Section
              title="熱門景點"
              action={sights.length > 3 ? "看全部" : undefined}
              onAction={() => setTab("sights")}
              tight
            >
              <div className="px-5">
                {sights.slice(0, 3).map((p) => (
                  <PoiRow key={p.id} poi={p} sub={subFor(p)} onClick={() => openPoi(p)} />
                ))}
              </div>
            </Section>
          )}

          {foods.length > 0 && (
            <Section
              title="在地美食"
              action={foods.length > 3 ? "看全部" : undefined}
              onAction={() => setTab("food")}
            >
              <div className="px-5">
                {foods.slice(0, 3).map((p) => (
                  <PoiRow key={p.id} poi={p} sub={p.area} onClick={() => openPoi(p)} />
                ))}
              </div>
            </Section>
          )}

          {stories.length > 0 && (
            <Section
              title="ResoMap 故事"
              action={stories.length > 3 ? "看全部" : undefined}
              onAction={() => setTab("story")}
            >
              <div className="px-5">
                {stories.slice(0, 3).map((p) => (
                  <PoiRow
                    key={p.id}
                    poi={p}
                    sub={subFor(p)}
                    storyLabel
                    onClick={() => openPoi(p)}
                  />
                ))}
              </div>
            </Section>
          )}

          {plans.length > 0 && (
            <Section title="推薦行程">
              <div className="px-5">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={plan}
                    className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left last:border-0 active:bg-surface"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-[19px]">
                      {p.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-ink">
                        {p.title}
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{p.sub}</div>
                    </div>
                    <span className="shrink-0 text-[15px] text-ink-3">›</span>
                  </button>
                ))}
              </div>
              <Note>推薦行程是 Demo 範例，正式版會依你的日期、人數與想去的地方重新安排。</Note>
            </Section>
          )}

          {deals.length > 0 && (
            <Section title="優惠活動">
              <div className="space-y-2 px-5">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} onOpen={nav.openDeal} />
                ))}
              </div>
              {/* These cards carry NT$ figures. Every other commercial surface
                  in the app states that they are indicative and that ResoMap
                  has no agreement with the platforms; this one must too. */}
              <Note>{AFFILIATE_DISCLOSURE}</Note>
            </Section>
          )}
        </>
      )}

      {tab === "sights" && (
        <List
          items={sights}
          sub={subFor}
          onPick={openPoi}
          empty="這個目的地還沒有收錄景點"
          icon="📍"
        />
      )}

      {tab === "food" && (
        <List
          items={foods}
          sub={(p) => p.area}
          onPick={openPoi}
          empty="這個目的地還沒有收錄美食"
          icon="🍜"
        />
      )}

      {tab === "story" && (
        <List
          items={stories}
          sub={subFor}
          storyLabel
          onPick={openPoi}
          empty="這裡的語音故事還在錄製中"
          icon="🎧"
        />
      )}

      {tab === "events" && (
        <List
          items={events}
          sub={subFor}
          onPick={openPoi}
          empty="這個目的地還沒有收錄活動與市集"
          icon="🎪"
        />
      )}

      <div className="h-6" />

      <div className="sticky bottom-0 z-20 mt-auto border-t border-line bg-bg/95 px-5 pb-4 pt-3 backdrop-blur">
        <Button onClick={plan}>加入行程</Button>
      </div>
    </Screen>
  );
}

function List({
  items,
  sub,
  storyLabel,
  onPick,
  empty,
  icon,
}: {
  items: Poi[];
  sub: (p: Poi) => string;
  storyLabel?: boolean;
  onPick: (p: Poi) => void;
  empty: string;
  icon: string;
}) {
  if (!items.length) return <Empty icon={icon} text={empty} />;
  return (
    <div className="px-5 pt-3">
      {items.map((p) => (
        <PoiRow
          key={p.id}
          poi={p}
          sub={sub(p)}
          storyLabel={storyLabel}
          onClick={() => onPick(p)}
        />
      ))}
    </div>
  );
}

function PoiRow({
  poi,
  sub,
  storyLabel,
  onClick,
}: {
  poi: Poi;
  sub: string;
  /** On the story list the badge carries the length; elsewhere it is just the
      mark, so a 景點 row is not retitled by it. */
  storyLabel?: boolean;
  onClick: () => void;
}) {
  const minutes =
    storyLabel && poi.storyId ? story(poi.storyId)?.minutes : undefined;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-0 active:bg-surface"
    >
      <PoiThumb poi={poi} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-ink">{poi.name}</span>
          {poi.storyId && (
            <StoryBadge minutes={minutes} label={Boolean(storyLabel)} />
          )}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{sub}</div>
      </div>
      <span className="shrink-0 text-[15px] text-ink-3">›</span>
    </button>
  );
}

function subFor(p: Poi) {
  return `${p.area} · ${POI_KIND_LABELS[p.kind]}`;
}
