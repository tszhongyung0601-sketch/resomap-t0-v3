import { useState, type ReactNode } from "react";
import { PRODUCTS, cheapest } from "../data/affiliateProducts";
import { poiOf, viewOf } from "../lib/stop";
import { useNav } from "../nav";
import { DAY_MODES, LEG_LABEL, type DayMode, type Stop, type Trip } from "../types";
import { Button, Sheet } from "./ui";
import { MODE_ICON } from "../lib/modes";

/**
 * The pieces V3 borrowed from 去趣's itinerary: the tab strip across the top of
 * a trip, the day's 交通方式 and 一鍵排序, and the 優惠 line under each stop.
 * Kept out of TripTimeline.tsx because that file is already the longest in the
 * app and these are self-contained.
 */

/* ------------------------------------------------------------- the tabs */

/**
 * 總覽｜第 1 天｜第 2 天｜＋｜－
 *
 * One screen to the traveller, so moving between tabs replaces the route
 * rather than stacking it — 返回 from 第 3 天 goes back to the trip list, not
 * through 第 2 天 and 第 1 天 first.
 *
 * ＋ adds an empty day after the last. － removes the last day, asking first
 * when there is anything on it: a day with stops is somebody's afternoon, and
 * a one-tap delete of it is the kind of control people only use once.
 */
export function TripTabs({ trip, active }: { trip: Trip; active: "overview" | number }) {
  const nav = useNav();
  const [asking, setAsking] = useState(false);
  const last = trip.days[trip.days.length - 1];
  const onLast = last ? last.tracks.reduce((n, t) => n + t.stops.length, 0) : 0;
  const canRemove = trip.days.length > 1;

  const remove = () => {
    if (!last) return;
    nav.removeDay(trip.id);
    if (active === last.n) nav.replace({ k: "day", tripId: trip.id, n: last.n - 1 });
    setAsking(false);
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 no-scrollbar">
        <Tab on={active === "overview"} onClick={() => nav.replace({ k: "trip", id: trip.id })}>
          總覽
        </Tab>
        {trip.days.map((d) => (
          <Tab
            key={d.n}
            on={active === d.n}
            onClick={() => nav.replace({ k: "day", tripId: trip.id, n: d.n })}
          >
            第 {d.n} 天
          </Tab>
        ))}
        <Round label="增加一天" onClick={() => nav.addDay(trip.id)}>
          ＋
        </Round>
        <Round
          label="刪除最後一天"
          disabled={!canRemove}
          onClick={() => (onLast > 0 ? setAsking(true) : remove())}
        >
          －
        </Round>
      </div>

      {asking && last && (
        <Sheet open onClose={() => setAsking(false)} title={`刪除第 ${last.n} 天？`}>
          <div className="px-5 pb-5">
            <p className="text-[14px] leading-relaxed text-ink-2">
              {last.date}有 {onLast} 個行程，刪掉之後就不見了。
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => setAsking(false)}>
                取消
              </Button>
              <Button onClick={remove}>刪除</Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={`relative min-h-12 shrink-0 px-2.5 text-[15px] transition ${
        on ? "font-bold text-ink" : "font-medium text-ink-3"
      }`}
    >
      {children}
      {on && <span className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-full bg-ink" />}
    </button>
  );
}

function Round({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="relative ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-surface text-[17px] font-bold text-ink-2 after:absolute after:-inset-1 after:content-[''] active:bg-surface-2 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ 交通方式 */

/**
 * 設定交通方式, with 去趣's two ways of applying it.
 *
 * 全部更新 re-travels the whole day and re-times it from the first stop;
 * 部分更新 only remembers the choice for stops added from now on. Both are
 * spelled out above the buttons, because "partial" means nothing until
 * somebody says partial of what.
 */
export function ModeSheet({
  current,
  onApply,
  onClose,
}: {
  current?: DayMode;
  onApply: (mode: DayMode, scope: "all" | "partial") => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<DayMode>(current ?? "transit");
  return (
    <Sheet open onClose={onClose} title="設定交通方式">
      <div className="px-5 pb-5">
        <div className="space-y-2" role="radiogroup" aria-label="交通方式">
          {DAY_MODES.map((m) => {
            const on = m === mode;
            return (
              <button
                key={m}
                role="radio"
                aria-checked={on}
                onClick={() => setMode(m)}
                className={`flex min-h-13 w-full items-center gap-3 rounded-2xl px-4 text-left transition ${
                  on ? "bg-brand-wash ring-2 ring-brand" : "bg-surface active:bg-surface-2"
                }`}
              >
                <span className="text-[19px]" aria-hidden>
                  {MODE_ICON[m]}
                </span>
                <span className={`flex-1 text-[15px] ${on ? "font-bold text-ink" : "text-ink-2"}`}>
                  {LEG_LABEL[m]}
                </span>
                <span
                  className={`grid size-6 place-items-center rounded-full border-2 text-[12px] ${
                    on ? "border-brand bg-brand text-white" : "border-line"
                  }`}
                  aria-hidden
                >
                  {on ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
          <b className="text-ink-2">全部更新</b>：這一天每段路都改成{LEG_LABEL[mode]}，後面的時間跟著重算。
          <br />
          <b className="text-ink-2">部分更新</b>：已經排好的不動，之後新加的景點才用{LEG_LABEL[mode]}。
          {mode === "self" && (
            <>
              <br />
              自行安排不會估算路上時間，景點的時間也不會變。
            </>
          )}
        </p>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => onApply(mode, "all")}>
            全部更新
          </Button>
          <Button onClick={() => onApply(mode, "partial")}>部分更新</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------- 一鍵排序 */

/**
 * Pick where the day starts and, if it matters, where it ends; the order in
 * between is the shortest route. The traveller sets both ends because only
 * they know the day begins at the hotel or has to finish at the station.
 */
export function SortSheet({
  stops,
  onSort,
  onClose,
}: {
  stops: Stop[];
  onSort: (startId: string, endId: string | null) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(stops[0]?.id ?? "");
  const [end, setEnd] = useState<string | null>(null);
  const name = (s: Stop) => viewOf(s)?.title ?? "未命名";

  return (
    <Sheet open onClose={onClose} title="一鍵排序">
      <div className="px-5 pb-5">
        <p className="text-[13px] leading-relaxed text-ink-3">
          選好起點和終點，中間的景點會排成最順的路線，時間跟著重算。排完不滿意可以復原。
        </p>

        <Picker label="起點" value={start} onChange={(v) => setStart(v ?? start)} stops={stops} name={name} />
        <Picker
          label="終點"
          value={end}
          onChange={setEnd}
          stops={stops.filter((s) => s.id !== start)}
          name={name}
          none="不指定"
        />

        <div className="mt-5">
          <Button onClick={() => onSort(start, end)}>排序</Button>
        </div>
      </div>
    </Sheet>
  );
}

function Picker({
  label,
  value,
  onChange,
  stops,
  name,
  none,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  stops: Stop[];
  name: (s: Stop) => string;
  none?: string;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-[12.5px] font-semibold text-ink-3">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1.5 h-12 w-full rounded-xl bg-surface px-3.5 text-[15px] text-ink outline-none"
      >
        {none && <option value="">{none}</option>}
        {stops.map((s) => (
          <option key={s.id} value={s.id}>
            {name(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------- 優惠 line */

/**
 * The 優惠 line under a stop.
 *
 * When ResoMap lists admission to this place, the line names that product and
 * its indicative price and opens its page. Otherwise it says what it will do —
 * look for tickets and experiences at this place on Klook and KKday — and
 * opens the two-door results screen. It never invents a product name or a
 * price for a place nobody has checked.
 */
export function StopOffer({ stop }: { stop: Stop }) {
  const nav = useNav();
  const p = poiOf(stop);
  if (!p) return null;
  const product = PRODUCTS.find((x) => x.poiId === p.id);
  const low = product ? cheapest(product) : undefined;

  return (
    <div className="pl-[56px] pt-2">
      <button
        onClick={() =>
          product
            ? nav.go({ k: "product", id: product.id })
            : nav.go({ k: "dealSearch", q: p.name, cat: p.ticketed ? "ticket" : "tour" })
        }
        className="flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-xl bg-brand-wash pr-3 text-left active:opacity-80"
      >
        <span className="shrink-0 self-stretch bg-brand px-2.5 text-[12px] font-bold leading-10 text-white">
          優惠
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand">
          {product ? product.name : `找「${p.name}」的門票與體驗`}
        </span>
        {low && (
          <span className="num shrink-0 text-[12.5px] font-bold text-brand">
            NT$ {low.priceTwd.toLocaleString()}
          </span>
        )}
        <span className="shrink-0 text-[14px] text-brand" aria-hidden>
          ›
        </span>
      </button>
    </div>
  );
}
