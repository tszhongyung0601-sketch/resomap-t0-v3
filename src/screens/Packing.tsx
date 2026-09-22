import { useState } from "react";
import { Note, Screen, TopBar } from "../components/ui";
import { dest } from "../data/destinations";
import { useEditedTrip } from "../lib/dayEdits";
import { PACK_GROUPS, usePacking } from "../lib/packing";
import { useDaily } from "../lib/weather";
import { useNav } from "../nav";
import type { Trip } from "../types";

/**
 * 行李清單 for one trip. See lib/packing.ts for where each line comes from.
 */
export function Packing({ trip: source }: { trip: Trip }) {
  const nav = useNav();
  const trip = useEditedTrip(source);
  const d = dest(trip.destId);
  const sky = useDaily(d ? { lat: d.lat, lng: d.lng } : null);
  const pack = usePacking(trip, sky);
  const [draft, setDraft] = useState("");
  const pct = pack.items.length ? Math.round((pack.done / pack.items.length) * 100) : 0;

  return (
    <Screen>
      <TopBar title="行李清單" onBack={nav.back} />

      <div className="px-5">
        <div className="text-[13px] text-ink-3">{trip.title}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="num text-[28px] font-bold text-ink">{pack.done}</span>
          <span className="num text-[16px] font-semibold text-ink-3">/ {pack.items.length} 已打包</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-3">
          依這趟的天數、目的地、天氣和行程自動列出，灰字是為什麼要帶。
        </p>
      </div>

      {PACK_GROUPS.map((g) => {
        const rows = pack.items.filter((i) => i.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="mt-6">
            <h2 className="px-5 text-[14px] font-semibold text-ink-3">{g}</h2>
            <div className="mt-1.5">
              {rows.map((i) => {
                const on = pack.isChecked(i.id);
                return (
                  <div key={i.id} className="flex items-center gap-1 pr-2">
                    <button
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => pack.toggle(i.id)}
                      className="flex min-h-13 min-w-0 flex-1 items-center gap-3 px-5 py-2 text-left active:bg-surface"
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-md border-2 text-[13px] font-bold ${
                          on ? "border-ok bg-ok text-white" : "border-line bg-white"
                        }`}
                        aria-hidden
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[15px] ${on ? "text-ink-3 line-through" : "text-ink"}`}>
                          {i.label}
                        </span>
                        {"why" in i && i.why && (
                          <span className="mt-0.5 block text-[12px] text-ink-3">{i.why}</span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => pack.remove(i.id)}
                      aria-label={`刪除${i.label}`}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-[17px] text-ink-3 active:bg-surface"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <form
        className="mt-6 flex gap-2 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          pack.add(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="自己加一項，例如：相機"
          aria-label="新增行李項目"
          className="h-12 min-w-0 flex-1 rounded-xl bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-12 shrink-0 rounded-xl bg-ink px-4 text-[14.5px] font-bold text-white disabled:opacity-35"
        >
          新增
        </button>
      </form>

      {pack.hidden > 0 && (
        <button
          onClick={pack.restore}
          className="mx-5 mt-3 min-h-11 text-[13px] font-semibold text-ink-3 underline"
        >
          找回刪掉的 {pack.hidden} 項建議
        </button>
      )}

      <Note>清單只存在這支手機上。</Note>
      <div className="h-24 shrink-0" />
    </Screen>
  );
}
