import { useState } from "react";
import { DealSearchField } from "../components/DealSearchField";
import { Chip, Note, Screen, TopBar } from "../components/ui";
import {
  PLATFORMS,
  SEARCH_CATS,
  SEARCH_DISCLOSURE,
  catLabel,
  searchUrl,
  type SearchCat,
  type SearchPlatform,
} from "../data/affiliateLinks";
import { pushRecent } from "../lib/dealSearch";
import { track } from "../lib/track";
import { useNav } from "../nav";
import type { DealCategory } from "../types";

/**
 * 搜尋結果 — two doors, one per platform.
 *
 * There is no product list on this screen, on purpose. ResoMap has no live feed
 * from either platform, and a list of cards with prices on them would be a list
 * of guesses that looks like a list of facts. What is certain is that Klook and
 * KKday each have a results page for this word in this category, so that is
 * what the traveller is offered: pick a platform, land on its real results.
 *
 * The word and the category can both be changed here without going back. The
 * search is held in this screen's own state rather than pushed as a new route,
 * so refining it three times still leaves one tap of 返回 to the hub instead of
 * three.
 */

/* What the funnel files an outbound search under. 行程體驗 is a ticket to the
   commission table, the same way it is on both platforms' own reports. */
const FUNNEL: Record<SearchCat, DealCategory> = {
  ticket: "ticket",
  tour: "ticket",
  hotel: "stay",
  car: "transport",
};

export function DealSearch({ q: q0, cat: cat0 }: { q: string; cat: SearchCat }) {
  const nav = useNav();
  const [q, setQ] = useState(q0);
  const [draft, setDraft] = useState(q0);
  const [cat, setCat] = useState<SearchCat>(cat0);

  const submit = (word: string, c: SearchCat = cat) => {
    setQ(word);
    setDraft(word);
    setCat(c);
    pushRecent({ q: word, cat: c });
  };

  const placeholder = SEARCH_CATS.find((c) => c.id === cat)!.placeholder;

  return (
    <Screen>
      <TopBar
        title="搜尋結果"
        onBack={nav.back}
        below={
          <div className="px-4 pb-3">
            <DealSearchField
              value={draft}
              onChange={setDraft}
              onSubmit={(w) => submit(w)}
              placeholder={placeholder}
            />
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
              {SEARCH_CATS.map((c) => (
                <Chip key={c.id} active={c.id === cat} onClick={() => submit(q, c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
        }
      />

      <div className="px-5 pt-3">
        <h2 className="text-[19px] font-bold leading-snug text-ink">
          「{q}」的{catLabel(cat)}
        </h2>
        <p className="mt-1 text-[13px] text-ink-3">選一個平台看結果，會在新分頁開啟。</p>
      </div>

      <div className="space-y-3 px-5 pt-4">
        {PLATFORMS.map((p) => (
          <PlatformDoor key={p.id} platform={p.id} q={q} cat={cat} />
        ))}
      </div>

      <Note>{SEARCH_DISCLOSURE}</Note>
      <div className="h-24 shrink-0" />
    </Screen>
  );
}

/**
 * One platform's results, as a single large target.
 *
 * A real link rather than a button calling `window.open`: a phone's long-press
 * menu works on it, it is never caught by a popup blocker, and the address is
 * there for anybody who wants to see where they are being sent. `sponsored` is
 * the rel search engines ask affiliate links to carry.
 */
function PlatformDoor({ platform, q, cat }: { platform: SearchPlatform; q: string; cat: SearchCat }) {
  const p = PLATFORMS.find((x) => x.id === platform)!;
  const url = searchUrl(platform, cat, q);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => track("affiliate_outbound", { partner: platform, category: FUNNEL[cat] })}
      className="flex min-h-[92px] items-center gap-3.5 rounded-2xl bg-white p-4 ring-1 ring-line transition active:scale-[.99] active:bg-surface"
    >
      <span
        className="grid size-14 shrink-0 place-items-center rounded-2xl text-[15px] font-black tracking-tight"
        style={{ background: p.wash, color: p.ink }}
      >
        {p.name}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold text-ink">在 {p.name} 查看</span>
        <span className="mt-0.5 block truncate text-[13.5px] text-ink-2">
          「{q}」{catLabel(cat)}
        </span>
        <span className="mt-1 block text-[11.5px] text-ink-3">{p.site}</span>
      </span>
      <OutIcon />
    </a>
  );
}

function OutIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-ink-3"
      aria-hidden
    >
      <path d="M8 16L16.5 7.5M9.5 7h7.5v7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
