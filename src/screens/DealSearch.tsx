import { useState } from "react";
import { DealSearchField } from "../components/DealSearchField";
import { Chip, Note, Screen, TopBar } from "../components/ui";
import {
  PLATFORMS,
  SEARCH_CATS,
  SEARCH_DISCLOSURE,
  catLabel,
  doorsFor,
  type Door,
  type SearchCat,
} from "../data/affiliateLinks";
import { pushRecent } from "../lib/dealSearch";
import { track } from "../lib/track";
import { useNav } from "../nav";
import type { DealCategory } from "../types";

/**
 * 搜尋結果 — one door per platform page.
 *
 * There is no product list on this screen, on purpose. ResoMap has no live feed
 * from either platform, and a list of cards with prices on them would be a list
 * of guesses that looks like a list of facts. What is certain is that Klook and
 * KKday each have a results page for this word in this category, so that is
 * what the traveller is offered: pick a platform, land on its real results.
 *
 * The word, the category and the dates can all be changed here without going
 * back. They are held in this screen's own state rather than pushed as new
 * routes, so refining a search three times still leaves one tap of 返回.
 *
 * Dates arrive filled in when a trip's 旅遊指南 opened this screen. They reach
 * a platform only where its address takes them — Klook's hotel and flight
 * searches — and every other door says so, instead of silently dropping them.
 */

/* What the funnel files an outbound search under. 行程體驗 is a ticket to the
   commission table, the same way it is on both platforms' own reports. */
const FUNNEL: Record<SearchCat, DealCategory> = {
  ticket: "ticket",
  tour: "ticket",
  hotel: "stay",
  car: "transport",
  transport: "transport",
  flight: "transport",
};

/* The two date fields, named for what they mean in each category. */
const DATE_WORDS: Record<SearchCat, [string, string]> = {
  hotel: ["入住", "退房"],
  flight: ["去程", "回程"],
  car: ["取車", "還車"],
  ticket: ["開始", "結束"],
  tour: ["開始", "結束"],
  transport: ["出發", "回程"],
};

export function DealSearch({
  q: q0,
  cat: cat0,
  from: from0,
  to: to0,
}: {
  q: string;
  cat: SearchCat;
  from?: string;
  to?: string;
}) {
  const nav = useNav();
  const [q, setQ] = useState(q0);
  const [draft, setDraft] = useState(q0);
  const [cat, setCat] = useState<SearchCat>(cat0);
  const [from, setFrom] = useState(from0 ?? "");
  const [to, setTo] = useState(to0 ?? "");

  const submit = (word: string, c: SearchCat = cat) => {
    setQ(word);
    setDraft(word);
    setCat(c);
    pushRecent({ q: word, cat: c });
  };

  const placeholder = SEARCH_CATS.find((c) => c.id === cat)!.placeholder;
  const doors = doorsFor(cat, q, { from: from || undefined, to: to || undefined });
  const [w1, w2] = DATE_WORDS[cat];

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

      {/* Dates: native pickers, so the phone's own calendar opens. */}
      <div className="mx-5 mt-2 grid grid-cols-2 gap-2">
        <DateField label={w1} value={from} onChange={setFrom} />
        <DateField label={w2} value={to} min={from || undefined} onChange={setTo} />
      </div>

      <div className="px-5 pt-5">
        <h2 className="text-[19px] font-bold leading-snug text-ink">
          「{q}」的{catLabel(cat)}
        </h2>
        <p className="mt-1 text-[13px] text-ink-3">
          {cat === "flight"
            ? "機票只有 Klook 有賣，KKday 沒有。會在新分頁開啟。"
            : "選一個平台看結果，會在新分頁開啟。"}
        </p>
      </div>

      <div className="space-y-3 px-5 pt-4">
        {doors.map((d) => (
          <PlatformDoor key={d.url} door={d} cat={cat} />
        ))}
      </div>

      <Note>{SEARCH_DISCLOSURE}</Note>
      <div className="h-24 shrink-0" />
    </Screen>
  );
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-2xl bg-surface px-3.5 py-2">
      <span className="block text-[11.5px] font-semibold text-ink-3">{label}（選填）</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full bg-transparent text-[15px] font-semibold text-ink outline-none"
      />
    </label>
  );
}

/**
 * One platform page, as a single large target.
 *
 * A real link rather than a button calling `window.open`: a phone's long-press
 * menu works on it, it is never caught by a popup blocker, and the address is
 * there for anybody who wants to see where they are being sent. `sponsored` is
 * the rel search engines ask affiliate links to carry.
 */
function PlatformDoor({ door, cat }: { door: Door; cat: SearchCat }) {
  const p = PLATFORMS.find((x) => x.id === door.platform)!;

  return (
    <a
      href={door.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => track("affiliate_outbound", { partner: door.platform, category: FUNNEL[cat] })}
      className="flex min-h-[92px] items-center gap-3.5 rounded-2xl bg-white p-4 ring-1 ring-line transition active:scale-[.99] active:bg-surface"
    >
      <span
        className="grid size-14 shrink-0 place-items-center rounded-2xl text-[15px] font-black tracking-tight"
        style={{ background: p.wash, color: p.ink }}
      >
        {p.name}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold text-ink">{door.title}</span>
        <span className="mt-0.5 block truncate text-[13.5px] text-ink-2">{door.sub}</span>
        <span className="mt-1 block text-[11.5px] text-ink-3">
          {door.note ? `${p.site}・${door.note}` : p.site}
        </span>
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
