import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { AdaptCard } from "./components/AdaptCard";
import { OutboundSheet } from "./components/DealCard";
import { ArrivalSheet, StoryPlayer } from "./components/Story";
import { Button, Sheet, Tag } from "./components/ui";
import { StopThumb } from "./components/Cover";
import {
  ADAPTS,
  HUALIEN_TRIP,
  ROOM_TRIP,
  TAINAN_TRIP,
  TOKYO_TRIP,
  dest,
} from "./data";
import { applyAdapt } from "./lib/adapt";
import { distance } from "./lib/geo";
import { newStop, placeOf, viewOf, viewsOf } from "./lib/stop";
import { audio as audioById } from "./lib/audio";
import { stopSpeaking } from "./lib/speech";
import { focusTrip } from "./lib/trip";
import { track } from "./lib/track";
import { NavContext, type Nav, type Route, type Tab } from "./nav";
import { Explore } from "./screens/Explore";
import { Trips } from "./screens/Trips";
import { AddPoiSheet } from "./screens/AddPoi";
import { Travellers, Consensus, Alternatives } from "./screens/Group";
import {
  CarRentalFlow,
  MoreServicesSheet,
  ServiceFlow,
  StayFlow,
  TransportFlow,
} from "./screens/Services";
import { ProductDetail, Tickets } from "./screens/Tickets";
import { Prefs, Pool, ConsensusView } from "./screens/Together";
import { Expenses, Settle, resetReceipts } from "./screens/Expenses";
import { resetHere } from "./lib/here";
import { resetDocs } from "./lib/docs";
import { clear, load, save, TRIPS_KEY } from "./lib/persist";
import { editsFor, forget, key as dayKey, resetDayEdits } from "./lib/dayEdits";
import { datesLabel, dayAfter } from "./lib/tripDates";
import { estimateLeg } from "./lib/reorder";
import { resetSaved } from "./lib/saved";
import { Library } from "./screens/Library";
import { resetReactions } from "./lib/reactions";
import { resetAccount } from "./lib/account";
import type { Deal, StoryLength, Trip } from "./types";

/**
 * Screens that are never on the first paint, split out of the entry chunk.
 *
 * The four tab roots stay eager — one of them renders immediately and a spinner
 * on app open would be a regression, not an optimisation. Everything else is
 * reached by a tap, which is exactly the moment a fetch is free: the chunk
 * arrives while the finger is still lifting.
 *
 * `lazy()` wants a default export and these are named, so each one adapts its
 * own module rather than every screen file growing a default export it does not
 * otherwise need.
 */
const Search = lazy(async () => ({ default: (await import("./screens/Search")).Search }));
const Destination = lazy(async () => ({ default: (await import("./screens/Destination")).Destination }));
const Poi = lazy(async () => ({ default: (await import("./screens/Poi")).Poi }));
const MapTab = lazy(async () => ({ default: (await import("./screens/MapTab")).MapTab }));
const CreateTrip = lazy(async () => ({ default: (await import("./screens/CreateTrip")).CreateTrip }));
const Deals = lazy(async () => ({ default: (await import("./screens/Deals")).Deals }));
const Coupons = lazy(async () => ({ default: (await import("./screens/Coupons")).Coupons }));
const Saved = lazy(async () => ({ default: (await import("./screens/Saved")).Saved }));
const Language = lazy(async () => ({ default: (await import("./screens/Language")).Language }));
const CoEdit = lazy(async () => ({ default: (await import("./screens/CoEdit")).CoEdit }));
const Profile = lazy(async () => ({ default: (await import("./screens/Profile")).Profile }));
const BusinessDemo = lazy(async () => ({ default: (await import("./screens/BusinessDemo")).BusinessDemo }));
const DemoPanel = lazy(async () => ({ default: (await import("./screens/DemoPanel")).DemoPanel }));
const Today = lazy(async () => ({ default: (await import("./screens/Today")).Today }));
/* The largest screen in the app at 1,300 lines, and never the first thing
   drawn — the 行程 tab lists trips, and this is what a trip opens into. */
const TripHome = lazy(async () => ({ default: (await import("./screens/TripTimeline")).TripHome }));
const DayPlan = lazy(async () => ({ default: (await import("./screens/TripTimeline")).DayPlan }));
const Audios = lazy(async () => ({ default: (await import("./screens/Audios")).Audios }));
const AddAudio = lazy(async () => ({ default: (await import("./screens/AddAudio")).AddAudio }));
const Nearby = lazy(async () => ({ default: (await import("./screens/Nearby")).Nearby }));
const NearbyList = lazy(async () => ({ default: (await import("./screens/NearbyList")).NearbyList }));
const Merchant = lazy(async () => ({ default: (await import("./screens/Merchant")).Merchant }));
const Provider = lazy(async () => ({ default: (await import("./screens/Provider")).Provider }));
const Offer = lazy(async () => ({ default: (await import("./screens/Offer")).Offer }));
const Rental = lazy(async () => ({ default: (await import("./screens/Rental")).Rental }));
const Event = lazy(async () => ({ default: (await import("./screens/Event")).Event }));
const Events = lazy(async () => ({ default: (await import("./screens/Events")).Events }));
const Chat = lazy(async () => ({ default: (await import("./screens/Chat")).Chat }));
const DealsHub = lazy(async () => ({ default: (await import("./screens/DealsHub")).DealsHub }));
const DealSearch = lazy(async () => ({ default: (await import("./screens/DealSearch")).DealSearch }));
const Packing = lazy(async () => ({ default: (await import("./screens/Packing")).Packing }));
const Documents = lazy(async () => ({ default: (await import("./screens/Documents")).Documents }));
const Reviews = lazy(async () => ({ default: (await import("./screens/Reviews")).Reviews }));
const Subscribe = lazy(async () => ({ default: (await import("./screens/Subscribe")).Subscribe }));
const Pro = lazy(async () => ({ default: (await import("./screens/Pro")).Pro }));


/** The demo starts before anything has been booked. */
const INITIAL: Trip[] = [
  { ...HUALIEN_TRIP },
  { ...TOKYO_TRIP },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const [stack, setStack] = useState<Route[]>([]);
  /* Restored from the last session. An itinerary somebody built — added a
     place to, reordered, had the AI generate — is the one thing in this demo
     that is theirs rather than ours, and a plan that evaporates on refresh is
     a plan the app was only pretending to keep.

     The route stack deliberately does not survive: reopening on the fourth
     screen of a flow nobody remembers starting is disorienting, and where you
     were is not something you made. */
  const [trips, setTrips] = useState<Trip[]>(() => load(TRIPS_KEY, INITIAL));

  useEffect(() => {
    /* The untouched fixtures are not worth storing, and storing them would be
       actively wrong: they would pin this month's demo itinerary in somebody's
       browser and shadow the next change to it. The identity check is exact on
       purpose — every path that alters a trip builds a new array. */
    if (trips === INITIAL) clear(TRIPS_KEY);
    else save(TRIPS_KEY, trips);
  }, [trips]);

  /* overlays — these sit above whatever screen is showing */
  const [deal, setDeal] = useState<Deal | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [story, setStory] = useState<{
    poiId: string;
    length: StoryLength;
    /* Set when a specific guide was asked for rather than a place's story. */
    audioId?: string;
  } | null>(null);
  const [adding, setAdding] = useState<{ tripId: string; day: number } | null>(null);
  const [services, setServices] = useState(false);
  const [aiSheet, setAiSheet] = useState(false);
  /* Which trip the 行程有變 sheet was opened from. The scripted scenarios
     find their own trip through ADAPTS, but the chat edits whatever it is
     handed — and handing it `ongoing ?? focus` would let it write to a trip
     the traveller is not looking at. */
  const [aiSheetTripId, setAiSheetTripId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** Which adapt card is currently live, if any. */
  const [adapt, setAdapt] = useState<string | null>(null);
  const [usedAdapts, setUsedAdapts] = useState<string[]>([]);

  const route: Route | null = stack[stack.length - 1] ?? null;
  const ongoing = trips.find((t) => t.phase === "ongoing") ?? null;
  /* The same rule the home screen's card uses. Two different answers here meant
     the map and the deals tab could open on a different city than the trip the
     traveller had just tapped. */
  const focus = focusTrip(trips) ?? null;

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const nav: Nav = useMemo(
    () => ({
      trips,
      /* Pushing a route that is already open truncates back to it instead of
         stacking a second copy. Without this, trip -> day -> trip -> day makes
         Back walk the same two screens forever and the 行程 list becomes
         unreachable. */
      go: (r) =>
        setStack((s) => {
          const at = s.findIndex((x) => sameRoute(x, r));
          return at >= 0 ? s.slice(0, at + 1) : [...s, r];
        }),
      replace: (r) => setStack((s) => (s.length ? [...s.slice(0, -1), r] : [r])),
      back: () => setStack((s) => s.slice(0, -1)),
      tab: (t) => {
        setStack([]);
        setTab(t);
      },
      openDeal: (d) => setDeal(d),
      arrive: (poiId) => setArrival(poiId),
      play: (poiId, length = "full") => setStory({ poiId, length }),
      /* The guide knows which place it belongs to, so the caller does not have
         to pass one — and cannot pass a wrong one. */
      playAudio: (audioId) => {
        const g = audioById(audioId);
        if (g) setStory({ poiId: g.poiId, length: "full", audioId });
      },
      addTo: (tripId, day) => setAdding({ tripId, day }),
      moreServices: () => setServices(true),

      addStop: (tripId, day, ref) => {
        /* Built once, outside the setter: React may call a state updater twice,
           and a stop id containing Date.now() would then differ between the two
           runs. Resolving here also means an unknown id is a no-op rather than
           an appended stop that renders as nothing. */
        const stop = newStop(ref);
        if (!stop) return;
        const view = viewOf(stop);

        setTrips((list) =>
          list.map((t) => {
            if (t.id !== tripId) return t;
            const days = t.days.map((d) => {
              if (d.n !== day) return d;
              const tracks = [...d.tracks];
              const last = tracks[tracks.length - 1];
              const prev = last.stops[last.stops.length - 1];
              const prevView = prev ? viewOf(prev) : null;
              const metres = prevView && view ? distance(prevView, view) : 0;
              /* 部分更新 lands here: a day whose 交通方式 was set travels its
                 new stops that way. The hand edit, when there is one, is where
                 the traveller's choice lives. */
              const mode = editsFor(dayKey(t.id, d.n))?.mode ?? d.mode;
              tracks[tracks.length - 1] = {
                ...last,
                stops: [
                  ...last.stops,
                  {
                    ...stop,
                    /* Appended after the day's last stop, not squeezed in. Where
                       exactly it lands is the traveller's call, not ours. */
                    at: addMinutes(prev?.at ?? "10:00", (prev?.stayMin ?? 0) + 20),
                    from: metres
                      ? /* No 交通方式 set: judged by distance, so a place in another
                           city is not a twenty-four-hour walk. */
                        estimateLeg(mode ?? (metres < 1200 ? "walk" : metres < 20000 ? "transit" : "drive"), metres)
                      : undefined,
                  },
                ],
              };
              return { ...d, tracks };
            });
            return { ...t, days };
          }),
        );
        if (ref.kind === "poi") track("poi_add", { poiId: ref.poiId });
        /* Named, because the tap that opens this sheet and the tap that commits
           it can be twenty seconds and three chips apart — 「已加入 Day 2」 alone
           made the traveller trust their own memory of what they had picked. */
        say(view ? `✓ ${view.title}已加入 Day ${day}` : `✓ 已加入 Day ${day}`);
      },

      addDay: (tripId) =>
        setTrips((list) =>
          list.map((t) => {
            if (t.id !== tripId || t.days.length === 0) return t;
            const last = t.days[t.days.length - 1];
            const n = last.n + 1;
            const days = [
              ...t.days,
              { n, ...dayAfter(last), tracks: [{ id: `${t.id}-d${n}-${Date.now()}`, who: [], stops: [] }] },
            ];
            return { ...t, days, nights: days.length - 1, dates: datesLabel(days) || t.dates };
          }),
        ),

      removeDay: (tripId) =>
        setTrips((list) =>
          list.map((t) => {
            if (t.id !== tripId || t.days.length <= 1) return t;
            const gone = t.days[t.days.length - 1];
            /* Its hand edits go with it — a Day 4 added back later is a new
               day, and must not inherit the old one's reorder. */
            forget(dayKey(t.id, gone.n));
            const days = t.days.slice(0, -1);
            return {
              ...t,
              days,
              nights: days.length - 1,
              dates: datesLabel(days) || t.dates,
              today: Math.min(t.today, days.length),
            };
          }),
        ),

      saveTrip: (trip) => {
        setTrips((l) => [trip, ...l.filter((t) => t.id !== trip.id)]);
        setStack([{ k: "trip", id: trip.id }]);
        setTab("trips");
      },

      adoptTrip: (tripId) => {
        const demo = [TAINAN_TRIP, HUALIEN_TRIP, TOKYO_TRIP, ROOM_TRIP].find((t) => t.id === tripId);
        if (!demo) return;
        setTrips((l) => (l.some((t) => t.id === tripId) ? l : [{ ...demo }, ...l]));
        setStack([{ k: "trip", id: tripId }]);
        setTab("trips");
      },

      createTrip: (destId) => {
        const existing = trips.find((t) => t.destId === destId);
        if (existing) {
          setStack([{ k: "trip", id: existing.id }]);
          setTab("trips");
          return;
        }
        setTrips((l) => [newTrip(destId), ...l]);
        setStack([{ k: "trip", id: `trip-${destId}` }]);
        setTab("trips");
      },
    }),
    [trips, say],
  );

  /* --------------------------------------------------- demo scenario hooks */

  function reset() {
    stopSpeaking();
    /* The same array the app started from, so the effect above clears the
       stored copy rather than writing the fixtures back over it. */
    setTrips(INITIAL);
    /* The hand-moved stops are a fourth store, and now they outlive the tab.
       A reset that rolls the itinerary back to the fixture and leaves last
       run's reorder sitting on top of it is not a reset. */
    resetDayEdits();
    /* Scanned documents are the traveller's, and a reset that leaves
       somebody's boarding pass on the device is not a reset. */
    resetDocs();
    /* The receipts live in a module store, not in `trips`, so they need saying
       out loud — otherwise a bill entered in one demo run is still there in the
       next one, under a trip that has been rolled back. */
    resetReceipts();
    /* The saved shelf is a third module store outside `trips`; a demo reset that
       leaves yesterday's hearts filled is not a reset. */
    resetSaved();
    /* Back to 新店, with everything else the demo reset puts back. */
    resetHere();
    /* Two more module stores arrived with V2 — the likes and comments on a
       guide, and the subscription this device picked. A reset that leaves a
       merchant subscription switched on is not a reset. */
    resetReactions();
    resetAccount();
    setAdapt(null);
    setUsedAdapts([]);
    setArrival(null);
    setStory(null);
    setDeal(null);
    setStack([]);
    setTab("explore");
  }

  function startTainan() {
    setTrips((l) => [{ ...TAINAN_TRIP }, ...l.filter((t) => t.id !== TAINAN_TRIP.id)]);
    setAdapt(null);
    setUsedAdapts([]);
    setStack([]);
    setTab("explore");
  }

  /**
   * Exactly one trip may be ongoing.
   *
   * Firing the Hualien scenario while the Tainan one was already running left
   * both marked ongoing, and every `find(t => t.phase === "ongoing")` in the app
   * then silently picked whichever happened to be first in the array.
   */
  const makeOngoing = (list: Trip[], tripId: string, day: number): Trip[] =>
    list.map((t) =>
      t.id === tripId
        ? { ...t, phase: "ongoing" as const, today: day }
        : t.phase === "ongoing"
          ? { ...t, phase: "soon" as const }
          : t,
    );

  function fireAdapt(id: string) {
    const a = ADAPTS.find((x) => x.id === id);
    if (!a) return;
    setTrips((l) => {
      const base = l.some((t) => t.id === a.tripId) ? l : [{ ...TAINAN_TRIP }, ...l];
      return makeOngoing(base, a.tripId, a.day);
    });
    setAdapt(id);
    setAiSheet(false);
    track("adapt_shown");
    setStack([{ k: "day", tripId: a.tripId, n: a.day }]);
    setTab("trips");
  }

  function applyCurrent() {
    const a = ADAPTS.find((x) => x.id === adapt);
    if (!a) return;
    setTrips((l) => l.map((t) => (t.id === a.tripId ? applyAdapt(t, a) : t)));
    /* Once applied, the day has already moved. Offering the same scenario again
       would shift it a second time and call the result a suggestion. */
    setUsedAdapts((u) => [...u, a.id]);
    setAdapt(null);
  }

  function arriveDemo() {
    setTrips((l) => {
      const base = l.some((t) => t.id === TAINAN_TRIP.id) ? l : [{ ...TAINAN_TRIP }, ...l];
      return makeOngoing(base, TAINAN_TRIP.id, 2);
    });
    setStack([{ k: "day", tripId: TAINAN_TRIP.id, n: 2 }]);
    setTab("trips");
    setArrival("chihkan");
  }

  /* --------------------------------------------------- the floating action */

  /**
   * One button, five jobs. Its label is the whole point: an assistant that says
   * "調整行程" while you are standing in the rain is a different product from one
   * that says "AI" everywhere and waits for you to think of something to type.
   */

  /* ----------------------------------------------------------- the screen */

  let screen: React.ReactNode = null;

  if (route?.k === "search") screen = <Search q={route.q} />;
  else if (route?.k === "dest") screen = <Destination id={route.id} />;
  else if (route?.k === "poi") screen = <Poi id={route.id} />;
  else if (route?.k === "create") screen = <CreateTrip destId={route.destId} />;
  else if (route?.k === "stay") screen = <StayFlow destId={route.destId} />;
  else if (route?.k === "tickets") screen = <Tickets destId={route.destId} />;
  else if (route?.k === "dealSearch")
    screen = <DealSearch key={`${route.q}|${route.cat}|${route.from ?? ""}`} q={route.q} cat={route.cat} from={route.from} to={route.to} />;
  else if (route?.k === "packing") {
    const t = trips.find((x) => x.id === route.tripId);
    screen = t ? <Packing trip={t} /> : null;
  }
  else if (route?.k === "product") screen = <ProductDetail id={route.id} />;
  else if (route?.k === "transport") screen = <TransportFlow destId={route.destId} />;
  else if (route?.k === "carrental") screen = <CarRentalFlow destId={route.destId} />;
  else if (route?.k === "service") screen = <ServiceFlow id={route.id} />;
  else if (route?.k === "deals")
    screen = <Deals destId={focus?.destId ?? null} tab={route.tab} />;
  else if (route?.k === "saved") screen = <Saved />;
  else if (route?.k === "language") screen = <Language />;
  else if (route?.k === "coupons") screen = <Coupons />;
  else if (route?.k === "coedit") screen = <CoEdit tripId={route.tripId} />;
  else if (route?.k === "business") screen = <BusinessDemo />;
  else if (route?.k === "expenses") screen = <Expenses tripId={route.tripId} add={route.add} />;
  else if (route?.k === "settle") screen = <Settle tripId={route.tripId} />;
  else if (route?.k === "today") {
    const t = trips.find((x) => x.id === route.tripId);
    screen = t ? <Today trip={t} onAdjust={() => { setAiSheetTripId(t.id); setAiSheet(true); }} /> : null;
  }
  else if (route?.k === "audios") screen = <Audios poiId={route.poiId} />;
  else if (route?.k === "addAudio") screen = <AddAudio poiId={route.poiId} />;
  else if (route?.k === "nearby") screen = <Nearby poiId={route.poiId} />;
  else if (route?.k === "nearbyList")
    screen = <NearbyList poiId={route.poiId} cat={route.cat} range={route.range} />;
  else if (route?.k === "merchant") screen = <Merchant id={route.id} />;
  else if (route?.k === "provider") screen = <Provider id={route.id} />;
  else if (route?.k === "offer") screen = <Offer id={route.id} />;
  else if (route?.k === "rental") screen = <Rental id={route.id} />;
  else if (route?.k === "event") screen = <Event id={route.id} />;
  else if (route?.k === "events") screen = <Events />;
  else if (route?.k === "chat") screen = <Chat tripId={route.tripId} />;
  else if (route?.k === "docs") screen = <Documents />;
  else if (route?.k === "reviews")
    screen = <Reviews kind={route.kind} id={route.id} />;
  else if (route?.k === "subscribe") screen = <Subscribe audience={route.audience} />;
  else if (route?.k === "pro") screen = <Pro />;
  else if (route?.k === "map") screen = <MapTab destId={focus?.destId ?? null} />;
  else if (route?.k === "profile") screen = <Profile />;
  else if (route?.k === "prefs") screen = <Prefs />;
  else if (route?.k === "pool") screen = <Pool />;
  else if (route?.k === "consensus2") screen = <ConsensusView />;
  else if (route?.k === "travellers") screen = <Travellers tripId={route.tripId} />;
  else if (route?.k === "consensus") screen = <Consensus tripId={route.tripId} />;
  else if (route?.k === "alternatives") screen = <Alternatives tripId={route.tripId} />;
  else if (route?.k === "demo") {
    screen = (
      <DemoPanel
        onBack={() => nav.back()}
        onStartTainan={startTainan}
        onTainanLate={() => fireAdapt("tainan-late")}
        onHualienRain={() => fireAdapt("hualien-rain")}
        onArrive={arriveDemo}
        onReset={reset}
      />
    );
  } else if (route?.k === "trip") {
    const t = trips.find((x) => x.id === route.id);
    screen = t ? <TripHome trip={t} /> : null;
  } else if (route?.k === "day" || route?.k === "tripmap") {
    const t = trips.find((x) => x.id === route.tripId);
    const a = ADAPTS.find((x) => x.id === adapt);
    screen =
      t && route.k === "day" ? (
        <DayPlan
          trip={t}
          day={route.n}
          onAdjust={() => {
            setAiSheetTripId(t.id);
            setAiSheet(true);
          }}
          banner={
            a && a.tripId === t.id && a.day === route.n ? (
              <AdaptCard
                adapt={a}
                trip={t}
                onApply={applyCurrent}
                onDismiss={() => setAdapt(null)}
              />
            ) : undefined
          }
        />
      ) : t ? (
        <TripRouteMap trip={t} day={route.n} />
      ) : null;
  } else {
    switch (tab) {
      case "deals":
        screen = <DealsHub />;
        break;
      case "trips":
        screen = <Trips trips={trips} />;
        break;
      case "library":
        screen = <Library />;
        break;
      default:
        screen = <Explore trips={trips} />;
    }
  }

  const hideNav = route?.k === "create" || Boolean(story);

  const overlay = (
    <>
      {arrival && !story && (
        <ArrivalSheet
          poiId={arrival}
          onPlay={(length) => {
            setStory({ poiId: arrival, length });
            setArrival(null);
          }}
          onLater={() => setArrival(null)}
        />
      )}

      {story && (
        <StoryPlayer
          poiId={story.poiId}
          length={story.length}
          audioId={story.audioId}
          /* Finish a guide and the next question is "what is around here" —
             which is the whole of the business model in one tap. The player
             asks it as five specific answers, so a category comes back with it
             and lands the traveller on that list rather than on a hub.
             Closing the player first, so Back lands on the screen they came
             from rather than reopening the player. */
          onExplore={(poiId, cat) => {
            setStory(null);
            nav.go(cat ? { k: "nearbyList", poiId, cat } : { k: "nearby", poiId });
          }}
          onClose={() => setStory(null)}
        />
      )}

      <OutboundSheet deal={deal} onClose={() => setDeal(null)} />

      {services && <MoreServicesSheet onClose={() => setServices(false)} />}

      {adding && (
        <AddPoiSheet
          tripId={adding.tripId}
          day={adding.day}
          onClose={() => setAdding(null)}
        />
      )}

      <AiSheet
        open={aiSheet}
        onClose={() => setAiSheet(false)}
        trip={trips.find((t) => t.id === aiSheetTripId) ?? ongoing ?? focus}
        used={usedAdapts}
        onAdapt={fireAdapt}
        onChat={() => {
          /* The trip the sheet was opened from, falling back only when it
             was opened from somewhere that has no trip of its own. */
          const id = aiSheetTripId ?? (ongoing ?? focus)?.id;
          setAiSheet(false);
          setStack((st) => [...st, { k: "chat", tripId: id }]);
        }}
      />

      {toast && (
        <div className="rm-in pointer-events-none absolute inset-x-0 bottom-28 z-50 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">
            {toast}
          </span>
        </div>
      )}
    </>
  );

  return (
    <NavContext.Provider value={nav}>
      <AppShell tab={tab} onTab={nav.tab} showNav={!hideNav} overlay={overlay}>
        {/* The fallback is the page's own white, not a spinner. These chunks are
            a few kilobytes over a warm connection; a spinner that flashes for
            80ms reads as jank, and an empty screen for 80ms reads as the tap
            having worked. */}
        <Suspense fallback={<div className="h-full bg-bg" />}>{screen}</Suspense>
      </AppShell>
    </NavContext.Provider>
  );
}

/* ------------------------------------------------------------- AI sheet */

/**
 * "What happened?" — the in-trip AI, as a list of things that actually happen.
 *
 * A text box would be less code and worse: somebody standing in the rain with a
 * dead afternoon does not want to compose a prompt. Every row here is a
 * situation a traveller recognises instantly, and the two the demo can genuinely
 * replan are wired to the real adapt engine. The rest say so rather than going
 * quietly missing — a person who is running late needs to see the app knows
 * "late" is a thing, even before it can fix it.
 */
const SITUATION_ICON: Record<string, string> = {
  RAIN: "🌧️",
  SLEEP: "😴",
  FOOD: "🍜",
  TIRED: "😫",
  CLOCK: "⏰",
  PIN: "📍",
  CHAT: "💬",
};

const SITUATIONS: {
  icon: string;
  label: string;
  trigger?: "rain" | "late";
  /* Not a scripted scenario — it opens the conversation, which works on any
     trip rather than only on the two the fixtures have an ADAPT for. */
  chat?: boolean;
}[] = [
  { icon: "RAIN", label: "下雨了", trigger: "rain" },
  { icon: "SLEEP", label: "起晚了", trigger: "late" },
  { icon: "FOOD", label: "想先吃東西" },
  { icon: "TIRED", label: "太累了" },
  { icon: "CLOCK", label: "時間不夠" },
  { icon: "PIN", label: "想去附近" },
  { icon: "CHAT", label: "直接告訴 AI", chat: true },
];

function AiSheet({
  open,
  onClose,
  trip,
  used,
  onAdapt,
  onChat,
}: {
  open: boolean;
  onClose: () => void;
  /** The trip being adjusted. */
  trip: Trip | null;
  /** Scenarios already applied — re-firing one would shift the day twice. */
  used: string[];
  onAdapt: (id: string) => void;
  /** Opens the conversation on this trip. */
  onChat: () => void;
}) {
  if (!open) return null;

  /* Which situations this trip can genuinely act on right now. */
  const live = new Map<string, string>();
  for (const a of ADAPTS) {
    if (used.includes(a.id)) continue;
    if (trip && a.tripId !== trip.id) continue;
    if (!live.has(a.trigger)) live.set(a.trigger, a.id);
  }

  return (
    <Sheet open onClose={onClose} title="發生什麼事？">
      <div className="px-5 pb-3">
        <p className="text-[13.5px] leading-relaxed text-ink-3">
          ResoMap 會看目前時間、位置與天氣，直接給你一份改好的行程。
        </p>

        <div className="mt-4 space-y-2">
          {SITUATIONS.map((s) => {
            const id = s.trigger ? live.get(s.trigger) : undefined;
            /* The chat is always ready: it needs no scripted scenario
               behind it, only a trip to talk about. */
            const ready = Boolean(id) || Boolean(s.chat && trip);
            return (
              <button
                key={s.label}
                disabled={!ready}
                onClick={() => (s.chat ? onChat() : id && onAdapt(id))}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-left ${
                  ready ? "bg-surface active:bg-surface-2" : "bg-surface/60"
                }`}
              >
                <span className={`text-[19px] ${ready ? "" : "opacity-40"}`}>
                  {SITUATION_ICON[s.icon]}
                </span>
                <span
                  className={`flex-1 text-[15px] font-semibold ${
                    ready ? "text-ink" : "text-ink-3"
                  }`}
                >
                  {s.label}
                </span>
                {!ready && <Tag kind="later" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <Button variant="ghost" onClick={onClose}>
            先不用
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------- trip route map */

function TripRouteMap({ trip, day }: { trip: Trip; day: number }) {
  const nav = useNavSafe();
  const d = trip.days.find((x) => x.n === day) ?? trip.days[0];
  const stops = d.tracks.flatMap((t) => t.stops);
  /* Resolved rather than looked up: a day can hold a hire car counter or a
     restaurant now, and a pin for one has to be able to exist. Anything whose
     record has gone drops off the map instead of taking it down. */
  const views = viewsOf(stops);
  const pins = views.map((v, i) => ({ poi: placeOf(v), order: i + 1 }));
  const [picked, setPicked] = useState<string | null>(null);
  /* Picked by stop id, not by place id: the same restaurant twice in one day
     used to select whichever came first. */
  const chosen = picked ? (views.find((v) => v.id === picked) ?? null) : null;
  const chosenStop = chosen ? stops.find((s) => s.id === chosen.id) : null;

  return (
    <div className="relative h-full">
      <MapOfTrip pins={pins} onPick={(id) => setPicked(id)} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4">
        <button
          onClick={() => nav.back()}
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-bg text-[18px] shadow-[0_2px_10px_rgba(0,0,0,.14)]"
          aria-label="返回"
        >
          ‹
        </button>
      </div>
      {chosen && (
        <div className="rm-up absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-bg px-5 pb-[88px] pt-4">
          <div className="flex items-center gap-3">
            <StopThumb view={chosen} size={52} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15.5px] font-bold text-ink">{chosen.title}</div>
              <div className="num text-[12.5px] text-ink-3">
                {chosenStop?.at} · 停留 {chosen.stayMin} 分
              </div>
            </div>
            {/* Only a place has a page to open. A hire car counter shows its
                name and its time and stops there, rather than offering a button
                that would land on nothing. */}
            {chosen.poi && (
              <button
                onClick={() => nav.go({ k: "poi", id: chosen.poi!.id })}
                className="shrink-0 rounded-full bg-surface px-4 py-2.5 text-[13px] font-bold text-ink"
              >
                查看
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Split out so the map import stays local to where it is used. */
import { MapCredit, MapView, type MapPin } from "./components/MapView";
import { useNav } from "./nav";

function useNavSafe() {
  return useNav();
}

function MapOfTrip({
  pins,
  onPick,
}: {
  pins: MapPin[];
  onPick: (id: string) => void;
}) {
  const centre: [number, number] = pins.length
    ? [pins[0].poi.lat, pins[0].poi.lng]
    : [23.6, 120.96];
  return (
    <>
      <MapView pins={pins} centre={centre} fit route onPick={(p) => onPick(p.id)} />
      <MapCredit />
    </>
  );
}

/* ------------------------------------------------------------------ util */

/** The five days the planner's calendar highlights. */
const PLAN_DAYS = [
  { n: 1, date: "8 月 20 日", weekday: "星期四" },
  { n: 2, date: "8 月 21 日", weekday: "星期五" },
  { n: 3, date: "8 月 22 日", weekday: "星期六" },
  { n: 4, date: "8 月 23 日", weekday: "星期日" },
  { n: 5, date: "8 月 24 日", weekday: "星期一" },
];

/**
 * A trip the planner just created: the chosen city, the dates the planner
 * actually showed, and five empty days.
 *
 * Cloning the Tainan itinerary here was quicker and much worse — picking 高雄
 * produced a trip called "台南 3 天 2 夜" full of Tainan stops, which is the
 * single most obvious way to prove a prototype is a mock-up.
 */
function newTrip(destId: string): Trip {
  const d = dest(destId);
  return {
    id: `trip-${destId}`,
    destId,
    title: `${d?.name ?? "新的旅程"} 5 天 4 夜`,
    dates: "8/20 - 8/24",
    nights: 4,
    phase: "upcoming",
    daysUntil: 7,
    today: 1,
    travellers: [],
    needsStay: true,
    days: PLAN_DAYS.map((p) => ({
      ...p,
      tracks: [{ id: `${destId}-d${p.n}`, who: [], stops: [] }],
    })),
  };
}

/** Two routes are the same screen if they point at the same thing. */
function sameRoute(a: Route, b: Route): boolean {
  if (a.k !== b.k) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function addMinutes(at: string, add: number) {
  const [h, m] = at.split(":").map(Number);
  const v = h * 60 + m + add;
  return `${String(Math.floor(v / 60) % 24).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}
