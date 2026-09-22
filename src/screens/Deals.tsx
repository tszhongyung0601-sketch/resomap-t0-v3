import { useMemo, useState } from "react";
import { DealCard } from "../components/DealCard";
import { Empty, Note, Screen, Tabs, TopBar } from "../components/ui";
import { AFFILIATE_DISCLOSURE, DEALS, dest } from "../data";
import { focusTrip } from "../lib/trip";
import { useNav } from "../nav";
import { DEAL_CATEGORY_LABELS } from "../types";
import type { Deal, DealCategory, Trip } from "../types";
import type { DealsTab } from "../nav";
import { poiOf } from "../lib/stop";

type TabId = DealsTab;

const TABS: { id: TabId; label: string }[] = [
  { id: "reco", label: "為你推薦" },
  { id: "ticket", label: "門票" },
  { id: "stay", label: "住宿" },
  { id: "transport", label: "交通" },
  { id: "car", label: "租車・接送" },
  { id: "more", label: "更多" },
];

/**
 * 租車・接送 split out of 交通.
 *
 * Transport records carry no sub-mode field, so the mode is read off the title —
 * the same rule Services.tsx already matches 租車 / 接送 with, kept identical so
 * the two screens can never disagree about where a deal belongs. Rail, passes
 * and airport express stay under 交通.
 */
const isCarOrTransfer = (d: Deal) => /租車|接送/.test(d.title);

/** 更多: the three categories nobody opens this tab for, but everybody needs. */
/* 在地優惠 left with V3 — there are no merchants to give one. */
const MORE_GROUPS: DealCategory[] = ["esim", "insurance"];

/**
 * eSIM and 旅平險 with no city of their own — the entire content of
 * 台灣境內都用得到. 為你推薦 above it excludes them so the same card cannot
 * appear twice on one screen under two different claims.
 */
const isUniversal = (d: Deal) =>
  !d.destId && (d.category === "esim" || d.category === "insurance");

const UNIVERSAL = DEALS.filter(isUniversal);

/**
 * These deals are city-less, not country-less.
 *
 * 「台灣 eSIM 5 天吃到飽」 and 「國內旅遊平安險 3 日」 both carry no `destId`
 * because no single city owns them — but read the titles: one is a Taiwan data
 * plan, the other is domestic cover. Printing them under a heading that says
 * they work anywhere is how somebody flying to 東京 ends up holding a SIM that
 * will not connect and a policy that excludes the trip. The heading was a claim
 * the data could not back for every destination in the set.
 *
 * So the block is shown for a Taiwan destination and for no destination at all,
 * and withheld the moment the trip leaves the country. Nothing is hidden by
 * this: every one of these cards is still one tap away under 更多.
 */
function universalFor(home: string | null): Deal[] {
  if (!home) return UNIVERSAL;
  return dest(home)?.country === "tw" ? UNIVERSAL : [];
}

/**
 * What 為你推薦 is allowed to contain.
 *
 * With a trip: that city, and nothing else. Padding the tail with other cities
 * puts a Tokyo ticket under a heading that says 與你的旅程相關, which is an
 * advert wearing a recommendation's words.
 *
 * 在地優惠 is left out of both branches: none of it is bookable yet, and three
 * disabled cards at the top of the tab is a worse answer than 更多, where they
 * sit with their 即將推出 label and an explanation.
 */
function recoList(home: string | null): Deal[] {
  const eligible = (d: Deal) => d.category !== "local" && !isUniversal(d);
  if (!home) return DEALS.filter(eligible);
  return DEALS.filter((d) => d.destId === home && eligible(d));
}

function catList(tab: Exclude<TabId, "reco" | "more">): Deal[] {
  if (tab === "transport")
    return DEALS.filter((d) => d.category === "transport" && !isCarOrTransfer(d));
  if (tab === "car")
    return DEALS.filter((d) => d.category === "transport" && isCarOrTransfer(d));
  return DEALS.filter((d) => d.category === tab);
}

interface Why {
  /** The line printed above the card. */
  text: string;
  /** Lower sorts higher. 0 = the traveller has already added this place. */
  rank: number;
}

/**
 * Why a card is in 與你的旅程相關, in the order the reasons actually know
 * something: the place is on the itinerary and on a named day, the city is the
 * one being travelled to, it is transport for a trip that exists.
 *
 * Anything else gets no line. 「ResoMap 推薦」 is not a reason, it is the absence
 * of one wearing the word — and `rank` makes that visible by sorting the
 * unreasoned cards underneath every card that can say why it is here.
 */
function makeReason(trip: Trip | undefined, home: string | null) {
  /* Day numbers are read off the focused trip alone. A "Day 2" printed beside a
     deal has to be Day 2 of the trip the traveller is actually looking at;
     scanning every trip would make the number true of some itinerary and wrong
     on this screen. */
  const dayOf = new Map<string, number>();
  if (trip)
    for (const d of trip.days)
      for (const tr of d.tracks)
        for (const s of tr.stops) {
          /* Deals are attached to places. A hire car in the itinerary carries
             no `poiId`, and letting an empty string into this map would make
             every deal without a POI claim to be on Day 1. */
          const id = poiOf(s)?.id;
          if (id && !dayOf.has(id)) dayOf.set(id, d.n);
        }

  return (deal: Deal): Why | null => {
    if (deal.poiId) {
      const n = dayOf.get(deal.poiId);
      if (n !== undefined) return { text: `你已加入 Day ${n}`, rank: 0 };
    }
    /* 「適合你的花蓮行程」 was a judgement the app cannot make: it knows the
       city, not the dates, the budget, or whether the room is already booked.
       What it can say is where the traveller is going, and that is checkable
       against the card underneath. */
    if (trip && deal.destId && deal.destId === home) {
      const city = dest(deal.destId)?.name;
      if (city) return { text: `你這趟要去${city}`, rank: 1 };
    }
    /* Every transport record in the demo names a city, so those resolve through
       the rule above. This branch is what a national product — a pass, a
       country-wide transfer — would land on. */
    if (trip && deal.category === "transport")
      return { text: "與目前目的地相關", rank: 2 };
    return null;
  };
}

/**
 * The line under the heading.
 *
 * It describes the filter that actually ran, and the filter is `home` — not
 * whether a trip exists. Keyed on the trip, 「這裡先照分類排列」 could sit above
 * a list already narrowed to one city, which is a promise about the list below
 * that the list below does not keep.
 */
function recoNote(city: string | null, hasTrip: boolean): string {
  if (!city) return "目前沒有行程可以參考，這裡先照分類排列。";
  return hasTrip
    ? `只顯示對得上這趟${city}行程的優惠，其他城市不會出現在這裡。`
    : `只顯示${city}的優惠，其他城市不會出現在這裡。`;
}

/**
 * The commercial tab, ordered by where the traveller is going.
 *
 * A coupon list sorted by category puts Tokyo tickets in front of somebody
 * standing in Tainan — the moment an offers page stops being useful and starts
 * being an ad break. 為你推薦 is the traveller's own trip first; the five
 * category tabs exist for the rarer case of browsing on purpose.
 */
export function Deals({ destId, tab: initial }: { destId: string | null; tab?: TabId }) {
  const nav = useNav();
  /* Seeded, not controlled: the caller says where to start and the reader is
     free to move. A controlled tab would snap back every time App re-rendered. */
  const [tab, setTab] = useState<TabId>(initial ?? "reco");

  /* App hands over the focused trip's city; resolving the trip here as well is
     what makes 你已加入 Day N possible, and the fallback keeps the screen
     correct if it is ever rendered without the prop. */
  const focus = focusTrip(nav.trips);
  const home = destId ?? focus?.destId ?? null;
  const city = home ? dest(home)?.name ?? null : null;

  const reason = useMemo(() => makeReason(focus, home), [focus, home]);

  /* One list, sorted once. `sort` is stable, so cards sharing a rank keep
     dataset order and the two rules compose instead of fighting; the array is
     the one `map` just produced, so nothing shared is mutated. */
  const reco = useMemo(
    () =>
      recoList(home)
        .map((d) => ({ d, why: reason(d) }))
        .sort((a, b) => (a.why?.rank ?? 3) - (b.why?.rank ?? 3)),
    [home, reason],
  );

  const universal = universalFor(home);
  const list = tab === "reco" || tab === "more" ? [] : catList(tab);

  return (
    <Screen>
      <TopBar
        title="優惠"
        large
        below={<Tabs items={TABS} value={tab} onChange={setTab} />}
      />

      <div className="px-5 pt-4">
        {tab === "reco" ? (
          <>
            <h2 className="text-[17px] font-bold text-ink">
              {focus ? "與你的旅程相關" : "為你推薦"}
            </h2>
            {/* Said once, and checkable: the list below really is filtered to
                this city, and every card really does carry its own reason. */}
            <p className="pb-3 pt-1 text-[13px] leading-relaxed text-ink-3">
              {recoNote(city, Boolean(focus))}
            </p>

            {reco.length === 0 ? (
              <p className="pb-1 text-[13px] leading-relaxed text-ink-3">
                這趟行程目前沒有可以看的優惠。
              </p>
            ) : (
              <div className="space-y-2.5">
                {reco.map(({ d, why }) =>
                  why ? (
                    <ReasonedCard
                      key={d.id}
                      deal={d}
                      why={why.text}
                      onOpen={nav.openDeal}
                    />
                  ) : (
                    <DealCard key={d.id} deal={d} onOpen={nav.openDeal} />
                  ),
                )}
              </div>
            )}

            {universal.length > 0 && (
              <>
                <h2 className="pb-3 pt-7 text-[14px] font-semibold text-ink-3">
                  台灣境內都用得到
                </h2>
                <div className="space-y-2.5">
                  {universal.map((d) => (
                    <DealCard key={d.id} deal={d} onOpen={nav.openDeal} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : tab === "more" ? (
          <MoreList onOpen={nav.openDeal} />
        ) : list.length === 0 ? (
          <Empty icon="🏷" text="這個分類目前沒有可以看的優惠" />
        ) : (
          <div className="space-y-2.5">
            {list.map((d) => (
              <DealCard key={d.id} deal={d} onOpen={nav.openDeal} />
            ))}
          </div>
        )}
      </div>

      {/* One block, at the bottom, for the whole screen — every tab. Repeating
          it per card would make the page read like a legal notice and get
          skipped, which is the opposite of disclosure. */}
      <Note>
        部分連結可能為聯盟行銷連結。若透過連結完成預訂，ResoMap
        可能取得分潤，不影響你的購買價格。
        <br />
        {AFFILIATE_DISCLOSURE}
      </Note>
      <div className="h-24 shrink-0" />
    </Screen>
  );
}

/**
 * 更多, kept in three named groups.
 *
 * Flattened, a bookable eSIM sits next to a 在地優惠 that is not open yet and
 * the card's own 即將推出 label is doing all the work of telling them apart.
 */
function MoreList({ onOpen }: { onOpen: (d: Deal) => void }) {
  return (
    <div className="space-y-7">
      {MORE_GROUPS.map((c) => {
        const items = DEALS.filter((d) => d.category === c);
        if (items.length === 0) return null;
        return (
          <section key={c}>
            <h2 className="text-[14px] font-semibold text-ink-3">
              {DEAL_CATEGORY_LABELS[c]}
            </h2>
            <div className="space-y-2.5 pt-3">
              {items.map((d) => (
                <DealCard key={d.id} deal={d} onOpen={onOpen} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* The reason belongs to the card underneath it, so it sits inside the same
   flex item — otherwise `space-y` reads it as a sibling of the card above. */
function ReasonedCard({
  deal,
  why,
  onOpen,
}: {
  deal: Deal;
  /** Never empty — a card without a reason is rendered as a plain DealCard. */
  why: string;
  onOpen: (d: Deal) => void;
}) {
  return (
    <div>
      <p className="px-1 pb-1 text-[12px] text-ink-3">{why}</p>
      <DealCard deal={deal} onOpen={onOpen} />
    </div>
  );
}
