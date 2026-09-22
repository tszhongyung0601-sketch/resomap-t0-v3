import { useRef, useState } from "react";
import { BrandBar } from "../components/BrandBar";
import { PhotoCredit, PoiImage } from "../components/Cover";
import { DealSearchField } from "../components/DealSearchField";
import { Note, Row, Screen, Section } from "../components/ui";
import { poi } from "../data";
import { dest } from "../data/destinations";
import { SEARCH_CATS, catLabel, type SearchCat } from "../data/affiliateLinks";
import { clearRecent, pushRecent, readRecent, type RecentSearch } from "../lib/dealSearch";
import { focusTrip } from "../lib/trip";
import { PartnerBadge } from "../components/Trade";
import { PARTNERS } from "../data/affiliatePartners";
import { AFFILIATE_OFFERS } from "../data/affiliateOffers";
import { CAR_RENTALS, RENTAL_DISCLOSURE } from "../data/carRentals";
import { MERCHANTS } from "../data/merchants";
import { PROVIDERS } from "../data/providers";
import { isVerifiedPartner } from "../lib/nearby";
import { useNav } from "../nav";
import type { MerchantCategory } from "../types";

/**
 * 更多優惠 — everything bookable, grouped by whose it is.
 *
 * The fourth tab. It replaced 一起規劃, which did not disappear: planning with
 * other people is something you do to a trip, so it moved next to the trip. What
 * took the slot was the half of this product that had no home at all — sixty-eight
 * merchants, forty-two drivers and guides, five affiliate platforms and
 * twenty-two hire counters, reachable only by scrolling to the bottom of the home
 * screen and tapping one of nine small icons.
 *
 * **Grouped by source before category, and that is the whole design.** These two
 * groups are not the same kind of thing and a traveller has a right to know
 * which they are reading. ResoMap's own merchants are reviewed, can earn the
 * 推薦夥伴 mark, and are the supply this company is responsible for. The
 * platforms are somebody else's inventory that ResoMap has no agreement with,
 * whose every `affiliateUrl` is empty. Sorting them together by category —
 * 住宿 next to 住宿 — would have merged those two facts into one list and quietly
 * borrowed the credibility of the reviewed half for the other.
 *
 * Nothing here is new. Every number on this screen is counted from data that
 * already shipped, and every row opens a screen that already existed.
 *
 * **V3 puts a search above all of it.** Somebody opening a shop tab mostly
 * knows the place and wants the ticket, the room or the car — so the top of
 * the screen asks for exactly that, the way Klook's own home screen does, and
 * hands the word to Klook and KKday on the next screen. Everything V2 had is
 * still here, in the same order, one scroll down.
 */
/* Places people actually type into Klook for Taiwan. Short on purpose: a rail
   of twenty is a list to read, and this is meant to be a shortcut. */
const HOT = ["日月潭", "九份", "墾丁", "花蓮", "台南", "台北101"];

export function DealsHub() {
  const nav = useNav();

  const merchantsBy = (c: MerchantCategory) =>
    MERCHANTS.filter((m) => m.category === c && m.reviewStatus !== "rejected").length;
  const verified = MERCHANTS.filter(isVerifiedPartner).length;
  const drivers = PROVIDERS.filter((p) => p.kind === "driver").length;
  const guides = PROVIDERS.filter((p) => p.kind === "guide").length;

  const offersBy = (k: "hotel" | "tour") => AFFILIATE_OFFERS.filter((o) => o.kind === k).length;

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<SearchCat>("ticket");
  const [recent, setRecent] = useState<RecentSearch[]>(readRecent);
  const input = useRef<HTMLInputElement>(null);

  /* The trip somebody is on — or about to leave for — is the most likely
     thing they came here to book for, so its city is the first shortcut. */
  const trip = focusTrip(nav.trips);
  const tripCity = trip ? dest(trip.destId)?.name : undefined;
  const hot = tripCity ? HOT.filter((h) => h !== tripCity) : HOT;

  const search = (word: string, c: SearchCat = cat) => {
    const w = word.trim();
    if (!w) return;
    setRecent(pushRecent({ q: w, cat: c }));
    nav.go({ k: "dealSearch", q: w, cat: c });
  };

  const placeholder = SEARCH_CATS.find((c) => c.id === cat)!.placeholder;
  const hero = poi("qixingtan");

  return (
    <Screen>
      <BrandBar title="更多優惠" />

      {/* ------------------------------------------------------------ search */}
      <div className="relative shrink-0 overflow-hidden" style={{ height: 232 }}>
        {/* Wrapped, because PoiImage carries its own `relative` and a second
            position class on the same element is decided by stylesheet order. */}
        <div className="absolute inset-0">
          <PoiImage poi={hero} height="100%" radius={0} emoji={false} large />
        </div>
        {/* Dark at the top for the headline, dark at the bottom for the field's
            shadow, clear in the middle so the photograph is still the point. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,.52) 0%, rgba(0,0,0,.12) 45%, rgba(0,0,0,.08) 60%, rgba(0,0,0,.38) 100%)",
          }}
        />
        <div className="relative px-5 pt-6">
          <h2 className="text-[27px] font-black leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,.35)]">
            想去哪裡玩？
          </h2>
          <p className="mt-1.5 text-[13.5px] font-medium text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,.4)]">
            搜一次，Klook 和 KKday 都幫你找好
          </p>
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <DealSearchField
            value={q}
            onChange={setQ}
            onSubmit={(w) => search(w)}
            placeholder={placeholder}
            inputRef={input}
            elevated
          />
        </div>
      </div>
      <PhotoCredit poi={hero} />

      {/* Picking a category is choosing what the search is for. With a word
          already typed it is also the search — making somebody tap a tile and
          then 搜尋 is one tap too many for a decision they have already made. */}
      <div className="grid grid-cols-4 gap-2 px-4 pt-4" role="radiogroup" aria-label="搜尋分類">
        {SEARCH_CATS.map((c) => {
          const on = c.id === cat;
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={on}
              onClick={() => {
                setCat(c.id);
                if (q.trim()) search(q, c.id);
                else input.current?.focus();
              }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 pb-2.5 pt-3 transition active:scale-[.97] ${
                on ? "bg-brand-wash ring-2 ring-brand" : "bg-white ring-1 ring-line active:bg-surface"
              }`}
            >
              <span className="text-[26px] leading-none" aria-hidden>
                {c.icon}
              </span>
              <span className={`text-[12.5px] font-semibold ${on ? "text-brand" : "text-ink-2"}`}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-5">
        <div className="text-[12.5px] font-semibold text-ink-3">熱門搜尋・{catLabel(cat)}</div>
        <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {tripCity && (
            <button
              onClick={() => search(tripCity)}
              className="relative shrink-0 rounded-full bg-brand-wash px-3.5 py-2 text-[13px] font-semibold text-brand after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-[''] active:bg-surface-2"
            >
              你的行程・{tripCity}
            </button>
          )}
          {hot.map((h) => (
            <button
              key={h}
              onClick={() => search(h)}
              className="relative shrink-0 rounded-full bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-[''] active:bg-surface-2"
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="px-5 pt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold text-ink-3">最近搜尋</span>
            <button
              onClick={() => {
                clearRecent();
                setRecent([]);
              }}
              className="-my-2.5 -mr-2 px-2 py-2.5 text-[12.5px] font-semibold text-ink-3"
            >
              清除
            </button>
          </div>
          <div className="mt-1">
            {recent.map((r) => (
              <button
                key={`${r.cat}-${r.q}`}
                onClick={() => {
                  setCat(r.cat);
                  search(r.q, r.cat);
                }}
                className="flex min-h-11 w-full items-center gap-3 text-left active:opacity-70"
              >
                <ClockIcon />
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{r.q}</span>
                <span className="shrink-0 text-[12px] text-ink-3">{catLabel(r.cat)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ ResoMap's own supply */}
      <Section title="ResoMap 合作商家" tight>
        {/* The badge on its own line rather than mid-sentence: inline, it broke
           the paragraph across it and left 「要付費」 stranded at the end of a
           line from 「並通過審核」. */}
        <p className="px-5 pb-2 text-[12.5px] leading-relaxed text-ink-3">
          ResoMap 自己收的商家與服務者，經過審核。
        </p>
        <p className="flex flex-wrap items-center gap-1.5 px-5 pb-3 text-[12.5px] leading-relaxed text-ink-3">
          <PartnerBadge short />
          <span>要付費並通過審核，兩個都要——付費本身不夠。</span>
        </p>

        {/* Counts, not links.

            These five were rows a moment ago, and every one of them opened the
            優惠 screen — which lists deals, not merchants. There is no global
            merchant browser in this app and inventing five buttons that land
            somewhere unrelated would be the dead control this project keeps
            deleting. The way in is genuinely from a place, because the ranking
            is by distance from where you are standing, and the line below says
            exactly that instead of pretending otherwise. */}
        <div className="grid grid-cols-3 gap-2 px-5">
          <Stat label="餐廳" value={merchantsBy("restaurant")} unit="家" />
          <Stat label="伴手禮" value={merchantsBy("souvenir")} unit="家" />
          <Stat label="住宿" value={merchantsBy("hotel")} unit="間" />
          <Stat label="包車司機" value={drivers} unit="位" />
          <Stat label="私人導遊" value={guides} unit="位" />
          <Stat label="推薦夥伴" value={verified} unit="家" />
        </div>

        <p className="px-5 pt-3 text-[12.5px] leading-relaxed text-ink-3">
          {MERCHANTS.length} 家商家裡有 {verified} 家掛著推薦夥伴標章。
          要看它們，從任何一個景點的「探索附近」進去——那份清單依你站的位置
          由近到遠排，所以它需要先知道你在哪裡。
        </p>

        <div className="px-5 pt-3">
          <Row
            icon="🏪"
            label="在地優惠"
            value="商家自己給的折扣"
            onClick={() => nav.go({ k: "deals", tab: "reco" })}
          />
        </div>
      </Section>

      {/* ------------------------------------------------------ somebody else's */}
      <Section title="更多比價" tight>
        <p className="px-5 pb-3 text-[12.5px] leading-relaxed text-ink-3">
          {PARTNERS.map((x) => x.name).join("・")}。
          這些是別人的庫存。ResoMap 參加 Klook、KKday 聯盟行銷計畫，與 Booking、Agoda、
          Trip.com 無合作關係；下面各頁的價格都是示意，要訂請用最上面的搜尋。
        </p>

        <Row icon="🎟️" label="門票・體驗" value="Klook / KKday" onClick={() => nav.go({ k: "tickets" })} />
        <Row icon="🏨" label="住宿" value={`${offersBy("hotel")} 間・Booking / Agoda`} onClick={() => nav.go({ k: "stay" })} />
        <Row icon="🚄" label="交通" value="高鐵 / 台鐵 / 機場交通" onClick={() => nav.go({ k: "transport" })} />
        <Row icon="✈️" label="機票" value="比價後前往訂票平台" onClick={() => nav.go({ k: "service", id: "flight" })} />
        <Row icon="🎫" label="一日遊・體驗" value={`${offersBy("tour")} 個行程`} onClick={() => nav.go({ k: "deals", tab: "ticket" })} />
        <Row icon="📶" label="eSIM" value="落地即可上網" onClick={() => nav.go({ k: "service", id: "esim" })} />
        <Row icon="🛡️" label="旅平險" value="單次投保" onClick={() => nav.go({ k: "service", id: "insurance" })} />
      </Section>

      {/* ------------------------------------------------------------- rentals */}
      <Section title="租車" tight>
        <p className="px-5 pb-3 text-[12.5px] leading-relaxed text-ink-3">
          真的公司、真的據點、真的座標，而且 ResoMap 跟它們每一家都沒有關係——
          所以每一張卡上都寫著「{RENTAL_DISCLOSURE}」。
        </p>
        <Row
          icon="🚗"
          label="租車・接送"
          value={`${CAR_RENTALS.length} 個據點`}
          onClick={() => nav.go({ k: "carrental" })}
        />
      </Section>

      <Section title="其他" tight>

        <Row icon="🏷️" label="我的折扣碼" onClick={() => nav.go({ k: "coupons" })} />
        <Row icon="👑" label="訂閱方案" onClick={() => nav.go({ k: "subscribe" })} />
      </Section>

      <Note>
        價格與供應狀況皆為 Demo 示意資料，非即時報價。ResoMap 參加 Klook、KKday
        聯盟行銷計畫，透過搜尋連結預訂可能獲得佣金，你付的價格不變；與 Booking、Agoda、
        Trip.com 及各租車業者皆無合作關係。
      </Note>

      <div className="h-24 shrink-0" />
    </Screen>
  );
}

/** A number and what it counts. Not tappable, because there is nowhere to go. */
function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-[15px] font-bold text-ink">
        {value} <span className="text-[12px] font-semibold text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="shrink-0 text-ink-3"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
