import { useMemo, useState } from "react";
import { poi } from "../data";
import { BY_DEST } from "../data/destinations";
import { PoiImage, RecordPhoto } from "../components/Cover";
import { Note, Screen, Segmented, TopBar } from "../components/ui";
import { InfoSheet } from "../components/Trade";
import { NEARBY_DISCLOSURE_SHORT } from "../data/nearbyCategories";
import { INFO, type InfoTopic } from "../data/info";
import {
  ALL_NEARBY_CARDS,
  NEARBY_SECTIONS,
  type NearbyCard,
  type NearbyCat,
  type Range,
} from "../data/nearbyCategories";
import { getNearbyCountUnit, nearbyCounts, type NearbyContext } from "../lib/nearby";
import { useNav } from "../nav";

/**
 * What is around the place you are standing in.
 *
 * V3: three questions, all answered by other people's real inventory — see
 * NEARBY_SECTIONS for why ResoMap's own four are gone.
 *
 * Five questions, not seven menu rows. The pictures lead because choosing
 * between "eat something" and "buy something to take home" is a mood, not a
 * database query — and because a screen of grey rows with emoji in them is a
 * back office, which is exactly what this screen must not look like.
 *
 * Where supply comes from is one small grey line at the bottom of each card.
 * Visible, because a traveller has a right to know whose recommendation they are
 * reading; quiet, because it is not what they came for. The full disclosure sits
 * once at the foot of the screen.
 *
 * A card with nothing behind it at the current radius still opens. It used to
 * go grey and refuse the tap, on the reasoning that a button with nothing
 * behind it is a dead button — but what a traveller reads on a greyed-out
 * 私人導遊 is "this feature is not built", not "there is no guide on this
 * street". So it opens, and the list says which of those two it is and offers
 * to widen the search. That is the difference between an empty state and a
 * broken one.
 */
export function Nearby({ poiId }: { poiId: string }) {
  const nav = useNav();
  const [range, setRange] = useState<Range>(5000);
  const [info, setInfo] = useState<InfoTopic | null>(null);
  const p = poi(poiId);

  const ctx: NearbyContext | null = useMemo(() => {
    if (!p) return null;
    return {
      at: { lat: p.lat, lng: p.lng },
      destId: p.destId,
      destName: BY_DEST[p.destId]?.name ?? "",
      poiArea: p.area,
      radiusM: range,
    };
  }, [p, range]);

  const counts = useMemo(() => (ctx ? nearbyCounts(ctx) : null), [ctx]);

  if (!p || !counts) return null;
  const city = BY_DEST[p.destId]?.name;
  /* Only the categories with a card. nearbyCounts still counts merchants,
     and adding those in would promise choices the screen does not show. */
  const total = ALL_NEARBY_CARDS.reduce((sum, c) => sum + counts[c.cat], 0);

  return (
    <Screen>
      <TopBar title="周邊推薦" onBack={() => nav.back()} />

      {/* Where "nearby" is measured from. Without it a distance is a number with
          no origin, and the traveller has no way to check it. */}
      <div className="px-5">
        <button
          onClick={() => nav.go({ k: "poi", id: p.id })}
          className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left active:bg-surface-2"
        >
          <PoiImage poi={p} height={52} radius={12} emoji={false} className="w-[68px]" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-bold text-ink">{p.name}附近</div>
            <div className="truncate text-[12.5px] text-ink-3">
              {[city, p.area].filter(Boolean).join(" · ")}
            </div>
          </div>
          <span className="shrink-0 text-[15px] text-ink-3" aria-hidden>
            ›
          </span>
        </button>
      </div>

      <div className="mt-3.5 flex items-center gap-3 px-5">
        <Segmented<string>
          items={[
            { id: "5000", label: "5 公里內" },
            { id: "10000", label: "10 公里內" },
          ]}
          value={String(range)}
          onChange={(v) => setRange(Number(v) as Range)}
        />
        <span className="num text-[12px] text-ink-3">{total} 個選擇</span>
      </div>

      {NEARBY_SECTIONS.map((s) => (
        <section key={s.id} className="mt-7">
          <h2 className="px-5 text-[17px] font-bold text-ink">{s.question}</h2>
          <div className={`mt-2.5 flex gap-2.5 px-5 ${s.cards.length > 1 ? "" : ""}`}>
            {s.cards.map((c) => (
              <CategoryCard
                key={c.cat}
                card={c}
                count={counts[c.cat as NearbyCat]}
                onOpen={() => nav.go({ k: "nearbyList", poiId, cat: c.cat, range })}
                onInfo={setInfo}
              />
            ))}
          </div>
        </section>
      ))}

      <Note>{NEARBY_DISCLOSURE_SHORT}</Note>
      <div className="h-24 shrink-0" />

      <InfoSheet topic={info} onClose={() => setInfo(null)} />
    </Screen>
  );
}

/**
 * One door, with a picture on it.
 *
 * Full width when the section has one card, half when it has two — a driver and
 * a guide are the same decision seen from two sides, and side by side is how
 * that reads. The count is on the image rather than under the title because it
 * is a qualifier, not a headline: 「5 公里內 3 家」 answers "is this worth
 * tapping" before the eye has reached the text.
 */
function CategoryCard({
  card,
  count,
  onOpen,
  onInfo,
}: {
  card: NearbyCard;
  count: number;
  onOpen: () => void;
  onInfo: (t: InfoTopic) => void;
}) {
  const empty = count === 0;
  const tall = card.half ? 118 : 168;

  return (
    /* An <article> wrapping two siblings, not one <button> with a button inside
       it. The card opens the list and the ⓘ opens two sentences — nesting them
       is invalid markup and behaves differently in every browser, which is the
       same reason Explore's guide cards and MerchantCard are built this way. */
    <article className="min-w-0 flex-1 overflow-hidden rounded-2xl bg-surface">
      <button
        onClick={onOpen}
        className="block w-full text-left transition active:bg-surface-2"
      >
        <div className={empty ? "opacity-55 grayscale" : ""}>
          <RecordPhoto
            record={card}
            fallbackId={card.cat}
            fallbackKind="attraction"
            emoji={card.emoji}
            height={tall}
            radius={0}
          >
            {/* A floor under the caption, so white text survives a bright
                photograph — 九份 at midday and a white shirt both need it —
                without a full-image scrim dulling the picture. */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
            <span className="absolute inset-x-3 bottom-2.5 flex items-end gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-bold text-white">
                  {card.title}
                </span>
                {!card.half && (
                  <span className="block truncate text-[12px] text-white/85">{card.sub}</span>
                )}
              </span>
              {/* 家 / 間 / 位 / 個行程 — one table in lib/nearby.ts, so no two
                  screens can count the same thing with different words. */}
              <span className="num shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 text-[11.5px] font-bold text-ink">
                {empty ? "看更遠" : `${count} ${getNearbyCountUnit(card.cat)}`}
              </span>
            </span>
          </RecordPhoto>
        </div>
      </button>

      {/* The quiet line. Grey, 11px — visible to anybody who looks, invisible to
          anybody who is choosing dinner. The whole explanation is behind the ⓘ. */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-3">{card.label}</span>
        <button
          onClick={() => onInfo(INFO[card.info])}
          aria-label={`${card.label}說明`}
          className="relative shrink-0 text-[11.5px] text-ink-3 after:absolute after:inset-x-0 after:-inset-y-[13px] after:content-['']"
        >
          ⓘ
        </button>
      </div>
    </article>
  );
}
