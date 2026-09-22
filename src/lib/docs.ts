import { useSyncExternalStore } from "react";
import { clear, load, save } from "./persist";
import { parseBoardingPass, type BoardingPass } from "./bcbp";
import { looksLikeFlight } from "./scan";
import { looksLikeEsim, parseEsim, type EsimCode } from "./lpa";

/**
 * The traveller's documents.
 *
 * Boarding passes, eSIM codes, hotel bookings — kept on the device and nowhere
 * else. That is not a promise about a privacy policy: this app has no backend,
 * so there is no server for one to reach. The screen says so plainly, because a
 * boarding pass carries a real name and a booking reference, and an eSIM code
 * is a live credential — somebody is entitled to know where they went.
 *
 * `raw` is always kept, even when parsing succeeded. A parser can be wrong, and
 * the string it was wrong about is the only way anybody could tell.
 */

export const DOCS_KEY = "resomap_v3_docs";

/**
 * What a document is.
 *
 * Two of these are detected and two are chosen, and the split is not
 * arbitrary: a boarding pass and an eSIM activation code both follow
 * published standards, so the app can read them and know. A hotel booking
 * follows nothing — its QR may be a URL, a Wi-Fi credential or a supplier's
 * internal number — so the traveller says what it is, and the app does not
 * guess.
 */
export type DocKind = "flight" | "esim" | "hotel" | "other";

export const DOC_LABELS: Record<DocKind, string> = {
  flight: "機票 / 登機證",
  esim: "eSIM",
  hotel: "住宿",
  other: "其他",
};

export const DOC_ICONS: Record<DocKind, string> = {
  flight: "✈️",
  esim: "📶",
  hotel: "🏨",
  other: "🎫",
};

export interface TravelDoc {
  id: string;
  kind: DocKind;
  addedAt: number;
  /** Exactly what was scanned or pasted. Never discarded. */
  raw: string;
  /** Only when `raw` genuinely parsed as a boarding pass. */
  flight?: BoardingPass;
  /** Only when `raw` genuinely parsed as an eSIM activation code. */
  esim?: EsimCode;
  /** What the traveller typed, for everything a standard cannot supply. */
  manual?: {
    title?: string;
    /** Check-in for a hotel, activation day for an eSIM. */
    date?: string;
    /** Check-out. Only a stay has two ends. */
    until?: string;
    /** The booking reference a hotel gives you, when the QR did not carry it. */
    ref?: string;
    note?: string;
  };
  /**
   * The trip this belongs to, once somebody has said so.
   *
   * Set by 對到行程 and by nothing else. A document is not guessed onto a trip
   * from its dates: two trips can overlap, a booking can be for somebody else,
   * and quietly filing a boarding pass under the wrong itinerary is the kind
   * of helpfulness nobody asked for.
   */
  tripId?: string;
  /** The barcode's own format, when it came from a scan. */
  format?: string;
}

/* --------------------------------------------------------------- the store */

/** Dates do not survive JSON; the flight is re-derived from `raw` on read. */
type Stored = Omit<TravelDoc, "flight" | "esim">;

function hydrate(d: Stored): TravelDoc {
  const flight = d.kind === "flight" ? (parseBoardingPass(d.raw) ?? undefined) : undefined;
  const esim = d.kind === "esim" ? (parseEsim(d.raw) ?? undefined) : undefined;
  return { ...d, flight, esim };
}

let state: TravelDoc[] = load<Stored[]>(DOCS_KEY, []).map(hydrate);
const watchers = new Set<() => void>();

function commit(next: TravelDoc[]) {
  state = next;
  /* The parsed flight is derived, so only the raw string and what the
     traveller typed are written. Storing a Date would give back a string on
     the next load and every consumer would have to know that. */
  const stored: Stored[] = next.map(({ flight, esim, ...rest }) => {
    void flight;
    void esim;
    return rest;
  });
  if (stored.length === 0) clear(DOCS_KEY);
  else save(DOCS_KEY, stored);
  for (const fn of watchers) fn();
}

function subscribe(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

const snapshot = () => state;

export function useDocs(): TravelDoc[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const docs = () => state;

/** The demo reset clears these with everything else. */
export const resetDocs = () => commit([]);

export function removeDoc(id: string) {
  commit(state.filter((d) => d.id !== id));
}

/** Attach a document to a trip, or detach it with null. */
export function linkDoc(id: string, tripId: string | null) {
  commit(state.map((d) => (d.id === id ? { ...d, tripId: tripId ?? undefined } : d)));
}

/** Everything filed under one trip, newest first. */
export const docsForTrip = (tripId: string) => state.filter((d) => d.tripId === tripId);

/**
 * Save what the traveller typed, and what they said this is.
 *
 * `kind` is honoured only for a document the app could not read for itself. A
 * boarding pass and an eSIM code are identified by published standards, and
 * letting a picker overrule that would mean the record and the string inside it
 * could disagree — which is exactly the state `raw` exists to make impossible.
 */
export function updateDoc(id: string, manual: TravelDoc["manual"], kind?: DocKind) {
  commit(
    state.map((d) => {
      if (d.id !== id) return d;
      const detected = Boolean(d.flight || d.esim);
      return {
        ...d,
        kind: detected ? d.kind : (kind ?? d.kind),
        manual: { ...d.manual, ...manual },
      };
    }),
  );
}

/**
 * File a scanned or pasted string.
 *
 * The kind is decided by what the string actually is, not by which button was
 * pressed: a boarding pass scanned under 「飯店」 is still a boarding pass, and
 * telling the traveller otherwise would be the app insisting it knows better
 * than the document in front of it.
 */
export function addDoc(raw: string, opts: { format?: string; kind?: DocKind } = {}): TravelDoc {
  const flight = looksLikeFlight(raw) ? parseBoardingPass(raw) : null;
  const esim = !flight && looksLikeEsim(raw) ? parseEsim(raw) : null;
  /* What it parses as wins over what was asked for. The two standards are
     unambiguous, so an eSIM code filed under 住宿 is still an eSIM code and
     the app should not agree to call it something else. */
  const kind: DocKind = flight ? "flight" : esim ? "esim" : (opts.kind ?? "other");

  const doc: TravelDoc = {
    id: `doc-${Date.now()}-${state.length}`,
    kind,
    addedAt: Date.now(),
    raw,
    flight: flight ?? undefined,
    esim: esim ?? undefined,
    format: opts.format,
  };
  commit([doc, ...state]);
  return doc;
}

/** 「BR 189・TPE → HLN」 or whatever the traveller called it. */
export function docTitle(d: TravelDoc): string {
  if (d.flight) return `${d.flight.carrier} ${d.flight.flightNo}・${d.flight.from} → ${d.flight.to}`;
  if (d.manual?.title) return d.manual.title;
  /* The server is the only human-readable thing in an activation code, and
     it is usually the carrier's own domain. Better than 「eSIM」 alone when
     somebody has two of them. */
  if (d.esim) return `eSIM・${d.esim.server}`;
  if (d.kind === "hotel") return "住宿憑證";
  if (d.kind === "esim") return "eSIM";
  return "文件";
}

const PAD = (n: number) => String(n).padStart(2, "0");

/** 「8/20」 or 「8/20 → 8/22」 — only what is genuinely known. */
export function docWhen(d: TravelDoc): string | null {
  if (d.flight) {
    const t = d.flight.date;
    return `${t.getMonth() + 1}/${PAD(t.getDate())}`;
  }
  /* A stay has two ends and a flight has one. Showing only the check-in
     date for a hotel would drop the half of the booking that decides
     whether tonight is covered. */
  if (d.manual?.date && d.manual?.until) return `${d.manual.date} → ${d.manual.until}`;
  return d.manual?.date ?? null;
}
