import { ADAPTS, ME, story } from "../data";
import { PoiImage, StopImage, StopThumb } from "../components/Cover";
import {
  Button,
  Empty,
  Row,
  Screen,
  Section,
  StoryBadge,
  TopBar,
} from "../components/ui";
import { dur } from "../lib/adapt";
import { openDirections, openPlaceDirections } from "../lib/maps";
import { viewOf } from "../lib/stop";
import { track } from "../lib/track";
import { useNav } from "../nav";
import { LEG_LABEL, type Adapt, type Day, type Stop, type Trip } from "../types";

/**
 * Today Mode — the screen somebody has open while standing on a street corner.
 *
 * It answers three questions and refuses the rest: where am I going, how do I
 * get there, is anything wrong. The full itinerary is one tap away and stays
 * there; a person walking does not read a timetable, they read the next line of
 * it. Everything the trip screen already says — dates, travellers, tickets,
 * accommodation — is deliberately absent, because on the street it is all noise
 * competing with the one instruction that matters.
 *
 * There is no clock. The app has never claimed to know the live time anywhere
 * else, and inventing one here — the single place a wrong time would send
 * somebody to the wrong stop — is the worst place to start.
 */
export function Today({ trip, onAdjust }: { trip: Trip; onAdjust: () => void }) {
  const nav = useNav();

  const day = trip.days.find((d) => d.n === trip.today) ?? trip.days[0];
  const stops = day ? myStops(day) : [];

  /* The traveller is standing at the first stop; the next one is what they need
     directions to. A day with a single stop has nowhere else to be, so that one
     stop is both. */
  const at = stops[0];
  const next = stops[1] ?? stops[0];
  /* The next stop is whatever it is — a place, a restaurant, or the counter
     where the hire car is waiting. `target` is the place behind it when there
     is one, because only a place has a story to offer. */
  const targetView = next ? viewOf(next) : null;
  const target = targetView?.poi ?? null;
  const fromView = next && next !== at && at ? viewOf(at) : null;
  const leg = next?.from;
  const st = target ? story(target.storyId) : undefined;

  /* Only a real, scripted disruption for this trip and this day — and only for
     as long as it is still unresolved. The banner has to be read off the live
     trip, not off the fixture: once the traveller has applied the plan the
     dropped stop is already missing from the list below, so a row still
     offering to remove it argues with the itinerary it is sitting on. Worse,
     tapping it opens a sheet where that scenario is greyed out as already used,
     which makes the one urgent-looking thing on the screen a dead end. */
  const scripted = ADAPTS.find((a) => a.tripId === trip.id && a.day === trip.today);
  const adapt = scripted && !applied(scripted, day) ? scripted : undefined;

  const nextAt = next ? stops.indexOf(next) : -1;
  const rest = nextAt >= 0 ? stops.slice(nextAt + 1, nextAt + 6) : [];

  const meta = [
    next && next.stayMin > 0 ? `停留 ${dur(next.stayMin)}` : null,
    leg ? `${LEG_LABEL[leg.mode]} ${leg.min} 分鐘` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <Screen>
      <TopBar
        title={trip.title}
        onBack={nav.back}
        right={
          <button
            onClick={() => nav.go({ k: "day", tripId: trip.id, n: trip.today })}
            className="-mr-2 inline-flex min-h-11 items-center rounded-full px-3 text-[13.5px] font-semibold text-ink-2 active:bg-surface"
          >
            完整行程
          </button>
        }
      />

      <div className="px-5 pt-1">
        {/* 今天, not 現在. The screen has no clock — see the note above — and
            "現在" is the one word on it that would imply otherwise. Which day
            the trip is on is data; what time it is is not. It is also the
            phrasing the trip screen already uses. */}
        <div className="text-[12.5px] font-semibold text-ink-3">今天</div>
        <div className="num mt-0.5 flex items-baseline gap-2">
          <span className="text-[26px] font-bold text-ink">Day {trip.today}</span>
          <span className="text-[15px] text-ink-3">/ {trip.nights + 1}</span>
        </div>
        {day && (
          <div className="mt-0.5 text-[13.5px] text-ink-3">
            {day.date} {day.weekday}
          </div>
        )}
      </div>

      {targetView && next ? (
        <>
          <section className="mt-6 px-5">
            <div className="mb-3 text-[17px] font-bold text-ink">下一站</div>

            {target ? (
              <PoiImage poi={target} height={160} radius={16} className="w-full" />
            ) : (
              <StopImage view={targetView} height={160} radius={16} className="w-full" />
            )}

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="num shrink-0 text-[22px] font-bold text-ink">
                {next.at}
              </span>
              <span className="min-w-0 flex-1 truncate text-[20px] font-bold text-ink">
                {targetView.title}
              </span>
            </div>

            {(meta.length > 0 || st) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {meta.length > 0 && (
                  <span className="text-[13px] text-ink-3">{meta.join(" · ")}</span>
                )}
                {st && <StoryBadge minutes={st.minutes} />}
              </div>
            )}

            {/* The only orange fill on this screen. Standing on a corner there
                is exactly one thing to do next, so the story sits next to it in
                grey and the adjustment row below stays a wash — two filled
                buttons here would make the traveller choose before moving. */}
            <div className="mt-4 space-y-2">
              <Button
                onClick={() => {
                  if (target) openDirections(fromView?.poi ?? null, target, leg?.mode ?? "walk");
                  else
                    openPlaceDirections({
                      name: targetView.title,
                      area: targetView.subtitle,
                      lat: targetView.lat,
                      lng: targetView.lng,
                    });
                }}
              >
                前往{targetView.title}
              </Button>
              {st && target && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    track("story_open", { poiId: target.id });
                    nav.play(target.id, "full");
                  }}
                >
                  🎧 聽故事
                </Button>
              )}
            </div>
          </section>

          {/* Absent when nothing is wrong. An "一切正常" row would be a line the
              traveller learns to stop reading, which is the one thing this row
              cannot afford to become. */}
          {adapt && (
            <div className="mt-6 px-5">
              <button
                onClick={onAdjust}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-brand-wash px-4 py-3 text-left transition active:scale-[.99]"
              >
                <span className="shrink-0 text-[17px]">{adapt.icon}</span>
                <span className="flex-1 text-[14.5px] font-semibold text-brand">
                  {adapt.headline}
                </span>
                <span className="shrink-0 text-[13px] font-bold text-brand">
                  看建議 ›
                </span>
              </button>
            </div>
          )}

          {rest.length > 0 && (
            <Section title="接下來">
              <div className="px-5">
                {rest.map((s) => (
                  <NextRow key={s.id} stop={s} />
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <Empty
          icon="🗺️"
          text="今天還沒有安排行程。"
          action="看完整行程"
          onAction={() => nav.go({ k: "day", tripId: trip.id, n: trip.today })}
        />
      )}

      <div className="mt-8">
        <Row
          icon="🧾"
          label="旅費"
          onClick={() => nav.go({ k: "expenses", tripId: trip.id })}
        />
      </div>

      <div className="h-24 shrink-0" />
    </Screen>
  );
}

function NextRow({ stop }: { stop: Stop }) {
  const nav = useNav();
  const v = viewOf(stop);
  if (!v) return null;

  const inner = (
    <>
      <span className="num w-11 shrink-0 text-[13.5px] font-semibold text-ink-3">
        {stop.at}
      </span>
      <StopThumb view={v} size={44} radius={12} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
        {v.title}
      </span>
      {stop.stayMin > 0 && (
        <span className="shrink-0 text-[12.5px] text-ink-3">
          停留 {dur(stop.stayMin)}
        </span>
      )}
    </>
  );

  const rowClass =
    "-mx-2 flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left";

  /* A place opens; a hire car counter has nothing to open. */
  return v.poi ? (
    <button
      onClick={() => nav.go({ k: "poi", id: v.poi!.id })}
      className={rowClass + " active:bg-surface"}
    >
      {inner}
    </button>
  ) : (
    <div className={rowClass}>{inner}</div>
  );
}

/**
 * Has this plan already been carried out on the live trip?
 *
 * Read off the itinerary rather than remembered in state: a dropped stop is
 * simply missing, a swapped stop points at its replacement. So the answer can
 * never disagree with the list the traveller is looking at, and it survives a
 * reload, which a boolean held in App would not.
 *
 * Each half is gated on the plan actually containing that kind of change —
 * `[].every()` is `true`, and without the length check a rain plan that only
 * swaps would count as "dropped" the moment it was rendered.
 */
function applied(adapt: Adapt, day: Day | undefined): boolean {
  if (!day) return false;
  const stops = day.tracks.flatMap((t) => t.stops);

  const dropped =
    adapt.plan.drop.length > 0 &&
    adapt.plan.drop.every((id) => !stops.some((s) => s.id === id));

  const swap = adapt.plan.swap ?? {};
  const swapped =
    Object.keys(swap).length > 0 &&
    Object.entries(swap).every(([id, poiId]) =>
      stops.some((s) => s.id === id && s.poiId === poiId),
    );

  return dropped || swapped;
}

/**
 * The stops this traveller is actually walking today.
 *
 * On a split day the itinerary holds two parallel tracks plus the shared one
 * everybody meets on; flattening all of them would tell somebody at Disneyland
 * that their next stop is 築地. A solo trip has `who: []` on its single track,
 * so an empty roster counts as "mine".
 */
function myStops(day: Day): Stop[] {
  const mine = day.tracks.filter((t) => t.who.length === 0 || t.who.includes(ME.id));
  const tracks = mine.length > 0 ? mine : day.tracks;
  return tracks.flatMap((t) => t.stops).sort((a, b) => a.at.localeCompare(b.at));
}
