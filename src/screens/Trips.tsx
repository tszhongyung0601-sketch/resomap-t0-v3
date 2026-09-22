import { useState } from "react";
import { poi } from "../data";
import { BrandBar } from "../components/BrandBar";
import { useNav } from "../nav";
import { Button, Card, Empty, Screen, Segmented, StoryBadge } from "../components/ui";
import { PoiThumb } from "../components/Cover";
import { DocumentsPane } from "./Documents";
import { TogetherPane } from "./Together";
import type { Trip } from "../types";
import { poiOf } from "../lib/stop";

/**
 * The 行程 tab, and deliberately the dullest screen in the app.
 *
 * A traveller opening this has one question — "which trip?" — so the list gives
 * a title, when it is, where it starts, and nothing else. Progress bars, budget
 * totals and completion counts all belong to somebody who is not standing in a
 * station trying to find their itinerary.
 */
/**
 * Three things that are all about a trip, under one tab.
 *
 * 一起規劃 used to be a tab of its own, which put "the trip" and "deciding the
 * trip with other people" two taps apart at the bottom of the screen. They are
 * the same subject. So this tab now holds the itineraries, the documents that
 * belong to them, and the room where a group argues about them.
 *
 * The list stays the default and stays first, unchanged. Somebody opening 行程
 * came to look at their itinerary, and a tab that greets them with a control
 * they have to read before they can see it has charged them for a feature they
 * did not ask for.
 */
type Pane = "trips" | "docs" | "together";

const PANES: { id: Pane; label: string }[] = [
  { id: "trips", label: "行程" },
  { id: "docs", label: "文件" },
  { id: "together", label: "一起規劃" },
];

export function Trips({ trips }: { trips: Trip[] }) {
  const nav = useNav();
  const [pane, setPane] = useState<Pane>("trips");

  return (
    <>
      <Screen>
        <BrandBar title="行程" />

        <div className="px-5 pb-3 pt-1">
          <Segmented<Pane> items={PANES} value={pane} onChange={setPane} />
        </div>

        {pane === "docs" && <DocumentsPane />}
        {pane === "together" && <TogetherPane />}

        {pane === "trips" && (
          <>
            {trips.length === 0 ? (
              <Empty
                icon="🧳"
                text="還沒有旅程"
                action="建立旅程"
                onAction={() => nav.go({ k: "create" })}
              />
            ) : (
              <>
                <div className="space-y-3 px-5 pt-1">
                  {trips.map((t) => (
                    <TripRow key={t.id} trip={t} />
                  ))}
                </div>
                <div className="px-5 pt-4">
                  <Button variant="ghost" onClick={() => nav.go({ k: "create" })}>
                    建立新旅程
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* Clearance for the floating button, so the last row is never
           the one hiding under it. */}
        <div className="h-24 shrink-0" />
      </Screen>

      {/* Only on the pane it writes to. The conversation reads and rewrites
         itineraries — it has nothing to say about a boarding pass, and
         nothing to add to a vote — so it is not offered there. */}
      {pane === "trips" && <ChatFab onClick={() => nav.go({ k: "chat" })} />}
    </>
  );
}

/**
 * The way into the conversation, floating over the list.
 *
 * This app deleted a floating AI button once before, and the reason is worth
 * keeping rather than rediscovering: that one sat on every screen and did a
 * different thing on each, so it taught nobody what it did. This one does
 * exactly one thing, says that thing on its face, and lives on one pane. An
 * icon-only circle would have thrown away the half of the lesson that was
 * about being legible — 💬 alone is not a promise anybody can read.
 *
 * It replaced a row above the list. The row worked, but it spent the width
 * of the screen and the top of the fold on an action, on the one screen
 * whose entire job is showing somebody their own trips.
 *
 * A sibling of `Screen`, not a child of it: the screen scrolls and this must
 * not. That puts it in the shell's screen area, which ends exactly where the
 * tab bar begins — so `bottom-4` is four units above the nav on the drawn
 * phone and above the home indicator on a real one, without this file
 * needing to know how tall either is.
 */
function ChatFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 z-30 flex h-13 items-center gap-2 rounded-full bg-brand pl-4 pr-5 text-white shadow-[0_6px_20px_rgba(0,0,0,.18)] transition active:scale-[.985] active:bg-brand-press"
    >
      <Bubble />
      <span className="text-[14.5px] font-bold text-white">跟 AI 說</span>
    </button>
  );
}

/* A hairline speech bubble, drawn like the four icons in the tab bar — the
   one floating control should not look like it came from another product. */
function Bubble() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden
    >
      <path
        d="M20.5 11.4c0 4-3.8 7.3-8.5 7.3a10 10 0 01-2.4-.3L5.2 20.3l1.2-3.2a7 7 0 01-2.9-5.7C3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.4z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const nav = useNav();
  const phase = phasePill(trip);
  const thumbs = firstDayPois(trip);

  return (
    <Card onClick={() => nav.go({ k: "trip", id: trip.id })} className="p-4">
      <div className="flex items-center gap-2">
        <span className="truncate text-[16px] font-bold text-ink">{trip.title}</span>
        {hasStory(trip) && <StoryBadge label={false} />}
        <span
          className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
            phase.live ? "bg-brand-wash text-brand" : "bg-surface-2 text-ink-3"
          }`}
        >
          {phase.text}
        </span>
      </div>

      <div className="num mt-1 text-[13px] text-ink-3">{trip.dates}</div>

      {thumbs.length > 0 && (
        <div className="mt-3 flex gap-2">
          {thumbs.map((id) => {
            const p = poi(id);
            return <PoiThumb key={id} poi={p} size={64} radius={12} />;
          })}
        </div>
      )}
    </Card>
  );
}

/**
 * One badge per trip, not one per place: the row is answering "which trip?", and
 * the itinerary itself is where the individual stops earn their own mark.
 */
function hasStory(trip: Trip): boolean {
  return trip.days.some((d) =>
    /* Only a place has a recorded guide, so anything that is not one simply
       does not count towards the badge — rather than throwing on its empty
       `poiId` and taking the whole trip list with it. */
    d.tracks.some((t) => t.stops.some((s) => Boolean(poiOf(s)?.storyId))),
  );
}

/** Day 1 is what a trip looks like in someone's head before they leave. */
function firstDayPois(trip: Trip): string[] {
  const day = trip.days[0];
  if (!day) return [];
  const ids = day.tracks.flatMap((t) => t.stops.flatMap((s) => poiOf(s)?.id ?? []));
  return [...new Set(ids)].slice(0, 4);
}

function phasePill(trip: Trip): { text: string; live: boolean } {
  if (trip.phase === "ongoing") return { text: "進行中", live: true };
  if (trip.phase === "soon") {
    return { text: trip.daysUntil ? `還有 ${trip.daysUntil} 天` : "即將出發", live: false };
  }
  return { text: "規劃中", live: false };
}
