import { useMemo, useState } from "react";
import { Button, Sheet } from "./ui";
import { StopThumb } from "./Cover";
import { useI18n } from "../i18n";
import { refKey, refOf, viewOf } from "../lib/stop";
import { useNav } from "../nav";
import type { StopRef, Trip } from "../types";

/**
 * Which day does this go on?
 *
 * It used to live inside Library.tsx, with a second copy in AddPoi.tsx and a
 * third path in Poi.tsx that skipped the question entirely and dropped the
 * place on whatever day the trip happened to be on. Three behaviours for one
 * decision, and the silent one was the worst of them: tapping 加入行程 on a
 * place put it somewhere the traveller never chose and never saw.
 *
 * It takes a `StopRef` rather than a POI id, so the same sheet adds a hire car
 * counter, a restaurant or a day tour — the question is the same question
 * whatever is being added, and answering it in three places would be three
 * chances to answer it differently.
 *
 * Committing calls `nav.addStop`, which is the app's only add path: it owns the
 * appended stop, the event and the 已加入 toast. Firing a second confirmation
 * here would tell the traveller twice about one tap.
 */
export function AddToTrip({
  target,
  trip,
  days,
  onClose,
}: {
  target: StopRef;
  trip: Trip;
  /**
   * Which days may be offered. Absent means all of them, which is right for
   * everything that is only a place — a restaurant is equally addable to any
   * afternoon.
   *
   * A festival is not. It happens on given days, and offering Day 3 for
   * something that ends on Day 2 would put a stop on an itinerary that could
   * never be attended. The caller works out which days qualify, because it is
   * the caller that knows what kind of thing this is; this sheet only has to
   * not offer the rest.
   */
  days?: number[];
  onClose: () => void;
}) {
  const nav = useNav();
  const { t, placeName } = useI18n();

  const view = useMemo(
    () =>
      viewOf({
        id: "preview",
        poiId: target.kind === "poi" ? target.poiId : "",
        ref: target,
        at: "",
        stayMin: 0,
      }),
    [target],
  );

  /* The days this sheet is allowed to offer, in the trip's own order. An
     empty `days` is treated as no restriction rather than as no days: the
     caller that means "none" should not be opening this sheet at all. */
  const offer = useMemo(
    () => (days?.length ? trip.days.filter((d) => days.includes(d.n)) : trip.days),
    [trip, days],
  );

  /* Open on the day the traveller is on — but only if it is on offer.
     `today` is free to run past the last one, and a default that matches no
     chip would leave the row looking unselected while the button named a day
     nobody had tapped. */
  const [pick, setPick] = useState(() =>
    offer.some((d) => d.n === trip.today) ? trip.today : (offer[0]?.n ?? trip.days[0].n),
  );

  const already = useMemo(() => {
    const wanted = refKey(target);
    const onDay = trip.days.find((d) => d.n === pick);
    return Boolean(
      onDay?.tracks.some((tr) => tr.stops.some((st) => refKey(refOf(st)) === wanted)),
    );
  }, [trip, pick, target]);

  if (!view) return null;

  const title = view.poi ? placeName(view.poi.id, view.title) : view.title;

  return (
    <Sheet open onClose={onClose} title={t("加入行程")}>
      <div className="px-5 pb-5 pt-1">
        <div className="rounded-2xl bg-surface p-3.5">
          <div className="flex items-center gap-3">
            <StopThumb view={view} size={44} radius={12} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-ink">{title}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                {view.subtitle} · 建議停留 {view.stayMin} 分
              </div>
              {/* A real company ResoMap has no agreement with. It says so on the
                  card that got the traveller here, and it says so again on the
                  sheet that puts it into their day. */}
              {view.disclosure && (
                <div className="mt-1 inline-block rounded-md bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">
                  {view.disclosure}
                </div>
              )}
            </div>
          </div>

          {/* The trip is named because nobody chose it here — focusTrip did.
              Without the title, 加入 Day 2 means "day 2 of something". */}
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="shrink-0 text-[13px] font-semibold text-ink-2">
              {t("要加到哪一天？")}
            </span>
            <span className="ml-auto truncate text-[12px] text-ink-3">{trip.title}</span>
          </div>

          {/* One chip per day this thing can actually go on — never a fixed
              seven, and never a day it could not be attended. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {offer.map((d) => (
              <button
                key={d.n}
                onClick={() => setPick(d.n)}
                className={`min-h-11 rounded-full px-3 text-[13px] font-semibold transition ${
                  d.n === pick ? "bg-brand text-white" : "bg-bg text-ink-2 active:bg-surface-2"
                }`}
              >
                Day {d.n}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <Button
              variant="onCard"
              disabled={already}
              onClick={() => {
                nav.addStop(trip.id, pick, target);
                onClose();
              }}
            >
              {already ? `Day ${pick} 已經有這個` : `加入 Day ${pick}`}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
