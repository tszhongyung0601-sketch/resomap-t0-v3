import { useEffect, useMemo, useState } from "react";
import { AFFILIATE_DISCLOSURE, BY_POI, dest, partner } from "../data";
import { BY_PRODUCT, PRODUCTS, cheapest } from "../data/affiliateProducts";
import { Empty, Note, Row, Screen, Section, Tabs, Thumb, TopBar } from "../components/ui";
import { PhotoCredit, PoiImage, PoiThumb } from "../components/Cover";
import { impression } from "../lib/track";
import { useNav } from "../nav";
import { PRODUCT_CATEGORY_LABELS } from "../types";
import type { AffiliateProduct, ProductCategory } from "../types";

type TabId = "popular" | ProductCategory;

const TABS: { id: TabId; label: string }[] = [
  { id: "popular", label: "熱門" },
  { id: "attraction", label: PRODUCT_CATEGORY_LABELS.attraction },
  { id: "themepark", label: PRODUCT_CATEGORY_LABELS.themepark },
  { id: "exhibition", label: PRODUCT_CATEGORY_LABELS.exhibition },
  { id: "experience", label: PRODUCT_CATEGORY_LABELS.experience },
  { id: "daytour", label: PRODUCT_CATEGORY_LABELS.daytour },
];

const price = (twd: number) => `NT$ ${twd.toLocaleString()} 起`;

/**
 * 門票・體驗 — a catalogue, not a pitch.
 *
 * The screen sells nothing on its own. It lists what exists, says what each
 * thing indicatively costs, and gets out of the way; the comparison that makes
 * the tap worth anything happens one level down, on the product.
 *
 * No tracking fires here. An impression is a commercial event and belongs to a
 * specific offer from a specific platform — counting a browse of the category
 * list as one would inflate the top of the funnel with people who never saw a
 * price from anybody.
 */
export function Tickets({ destId }: { destId?: string }) {
  const nav = useNav();
  const [tab, setTab] = useState<TabId>("popular");
  const here = destId ? dest(destId) : undefined;

  const list = useMemo(() => {
    const base =
      tab === "popular"
        ? PRODUCTS.filter((p) => p.popular)
        : PRODUCTS.filter((p) => p.category === tab);
    if (!destId) return base;
    /* The city being planned goes first inside every tab rather than filtering
       the others out — somebody browsing 樂園 from a 台南 trip is still allowed
       to see 台北. */
    return [
      ...base.filter((p) => p.destId === destId),
      ...base.filter((p) => p.destId !== destId),
    ];
  }, [tab, destId]);

  const hasLocal = Boolean(destId) && list.some((p) => p.destId === destId);

  return (
    <Screen>
      <TopBar
        title="門票・體驗"
        onBack={nav.back}
        below={
          <>
            <div className="px-5 pb-3">
              {/* A button, not an input. Search lives on its own screen, and a
                  field that looks live but opens another page is a small lie
                  the traveller pays for with a lost keystroke. */}
              <button
                onClick={() => nav.go({ k: "search", q: "" })}
                className="flex w-full items-center gap-2.5 rounded-2xl bg-surface px-4 py-3.5 text-left active:bg-surface-2"
              >
                <SearchIcon />
                <span className="text-[14.5px] text-ink-3">搜尋城市、景點或體驗</span>
              </button>
            </div>
            <Tabs items={TABS} value={tab} onChange={setTab} />
          </>
        }
      />

      <div className="px-5 pt-4">
        {hasLocal && here && (
          <p className="pb-3 text-[13px] text-ink-3">先看你正在規劃的{here.name}</p>
        )}

        {list.length > 0 ? (
          <div className="space-y-2.5">
            {list.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onOpen={() => nav.go({ k: "product", id: p.id })}
              />
            ))}
          </div>
        ) : (
          <Empty icon="🎟" text="這個分類目前沒有可以看的項目" />
        )}
      </div>

      <Note>{AFFILIATE_DISCLOSURE} 實際價格與可訂日期以各平台為準。</Note>
      <div className="h-24 shrink-0" />
    </Screen>
  );
}

/**
 * The city belongs on the row, not only on the product page.
 *
 * Every tab mixes cities on purpose, and the line above the list says "先看你正在
 * 規劃的台南" — so an unlabelled 東京迪士尼樂園 four rows further down reads as
 * though it were in 台南 too. Naming the city is what stops that hint from
 * quietly becoming a false claim about everything under it.
 */
function ProductRow({
  product,
  onOpen,
}: {
  product: AffiliateProduct;
  onOpen: () => void;
}) {
  /* `cheapest` reduces over `offers` seeded with `offers[0]`, so a record with
     no offers hands back undefined. Saying so is the right outcome — reading
     `low.priceTwd` would take the whole list down for one incomplete row. */
  const low = cheapest(product);
  const city = dest(product.destId)?.name;
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3.5 text-left transition active:bg-surface-2"
    >
      {product.poiId && BY_POI[product.poiId] ? (
        <PoiThumb poi={BY_POI[product.poiId]} size={52} />
      ) : (
        <Thumb emoji={product.emoji} tint={product.tint} size={52} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold leading-snug text-ink">
          {product.name}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
          {city ? `${city} · ${product.blurb}` : product.blurb}
        </div>
        <div className="num mt-1 text-[12.5px] font-semibold text-ink-2">
          {low ? price(low.priceTwd) : "價格以各平台為準"}
        </div>
      </div>
      <span className="shrink-0 text-[15px] text-ink-3">›</span>
    </button>
  );
}

/**
 * One product, and what each platform indicatively charges for it.
 *
 * The comparison is the whole reason this page exists. ResoMap has no agreement
 * with any of the platforms listed, so the only thing it can honestly offer is
 * the view across them — which is worth more to a traveller than a single price
 * dressed up as a deal.
 *
 * 最低價 is set in ink-3, not in brand orange and not in a badge. Orange would
 * make the cheapest row read as a recommendation ResoMap was paid to make.
 */
export function ProductDetail({ id }: { id: string }) {
  const nav = useNav();
  const p = BY_PRODUCT[id];

  const offers = useMemo(
    () => [...(p?.offers ?? [])].sort((a, b) => a.priceTwd - b.priceTwd),
    [p],
  );

  /* One impression per offer per mount, with the same id the synthetic Deal
     below carries, so impression → click → outbound actually join up. Matches
     DealCard, which counts a card the same way. */
  useEffect(() => {
    if (!p) return;
    for (const o of p.offers) impression(`p-${p.id}-${o.partner}`, o.partner, "ticket");
  }, [p]);

  if (!p) return null;

  const here = dest(p.destId);
  const place = p.poiId ? BY_POI[p.poiId] : undefined;
  const meta = [here?.name, PRODUCT_CATEGORY_LABELS[p.category]].filter(Boolean);

  /* Every offer that ties for cheapest, not just whichever one the sort put
     first. Stamping 最低價 on one of two identical prices tells the traveller
     the other platform costs more — a comparison claim the data never made. */
  const lowest = offers[0]?.priceTwd;

  return (
    <Screen>
      <div
        className="relative grid h-[200px] shrink-0 place-items-center text-[64px]"
        style={{ background: p.tint }}
      >
        {/* Admission to a real place gets that place's photograph. A day tour
            or a rafting trip is the operator's own product and has none, so it
            keeps the tile — see PoiThumb. */}
        {place ? (
          <div className="absolute inset-0">
            <PoiImage poi={place} height="100%" radius={0} emoji={false} large />
          </div>
        ) : (
          p.emoji
        )}
        <button
          onClick={() => nav.back()}
          aria-label="返回"
          className="absolute left-4 top-4 grid size-11 place-items-center rounded-full bg-bg/90 text-[19px] text-ink active:bg-bg"
        >
          ‹
        </button>
      </div>

      {/* A full-width photograph carries its licence line, as it does on the
          place's own page. */}
      {place && <PhotoCredit poi={place} />}

      <div className="px-5 pt-5">
        <h1 className="text-[22px] font-bold leading-snug text-ink">{p.name}</h1>
        <div className="mt-1.5 text-[13.5px] text-ink-3">{meta.join(" · ")}</div>
        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">{p.blurb}</p>
      </div>

      {place && (
        <div className="mt-4">
          <Row
            icon="📍"
            label="看看這個地方"
            value={place.name}
            onClick={() => nav.go({ k: "poi", id: place.id })}
          />
        </div>
      )}

      {offers.length > 0 && (
        <Section title="比較平台價格" tight>
          {/* Said where the numbers are, not only in the footnote at the bottom.
              A table headed 比較平台價格 reads as a live comparison unless it
              says otherwise, and by the time anybody reaches the Note they have
              already taken these figures for quotes. */}
          <p className="px-5 pb-2.5 text-[12.5px] leading-relaxed text-ink-3">
            示意價格，非即時報價；實際金額與可訂日期以各平台結帳頁為準。
          </p>
          <div className="space-y-2 px-5">
            {offers.map((o) => (
              <button
                key={o.partner}
                onClick={() =>
                  /* nav.openDeal speaks Deal, and an offer is not one. Building
                     the Deal here reuses the existing outbound sheet and its
                     affiliate tracking rather than forking a second one. */
                  nav.openDeal({
                    id: `p-${p.id}-${o.partner}`,
                    category: "ticket",
                    title: p.name,
                    partner: o.partner,
                    priceTwd: o.priceTwd,
                    destId: p.destId,
                    poiId: p.poiId,
                    emoji: p.emoji,
                    tint: p.tint,
                  })
                }
                className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3.5 text-left transition active:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-ink">
                      {partner(o.partner).name}
                    </span>
                    {o.priceTwd === lowest && (
                      <span className="shrink-0 text-[11.5px] text-ink-3">最低價</span>
                    )}
                  </div>
                  <div className="num mt-0.5 text-[13px] text-ink-3">
                    {price(o.priceTwd)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-bg px-3.5 py-2 text-[12.5px] font-bold text-brand">
                  查看
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* 「可能為」, not 「為」. The sentence above it says ResoMap has no
          agreement with any of these platforms; asserting that some links
          already ARE promotional contradicts it in the same paragraph. Matches
          the wording the 優惠 tab carries. */}
      <Note>
        {AFFILIATE_DISCLOSURE} 實際價格與可訂日期以各平台為準，部分連結可能為聯盟行銷連結。
      </Note>
      <div className="h-24 shrink-0" />
    </Screen>
  );
}

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
