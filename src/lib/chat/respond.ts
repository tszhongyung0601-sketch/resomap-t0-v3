import { BY_DEST } from "../../data/destinations";
import { audiosFor } from "../audio";
import { nearbyRentals } from "../nearby";
import { POIS } from "../../data";
import { distance } from "../geo";
import { generatePlan, type Plan, type PlanRequest, type TransportId } from "../planner";
import { viewOf } from "../stop";
import type { Intent } from "./intent";
import { INTEREST_LABELS, type InterestId, type Poi, type StopRef, type Trip } from "../../types";

/**
 * What to say back, and what to offer to do about it.
 *
 * Pure. Nothing here writes a trip, opens a screen or touches storage — it
 * returns words and, when the sentence asked for something, a `Proposal`
 * describing exactly what would change. `apply.ts` is the only thing that acts,
 * and it only ever acts on a proposal a person has pressed.
 *
 * That split is the whole design. A chat that edits your itinerary as you type
 * is a chat you have to watch; one that says "this is what I would do" and
 * waits is one you can argue with. It is the same rule the document scanner
 * follows, and the same rule the rain re-plan has followed since T0.
 */

export type Proposal =
  | { kind: "newTrip"; plan: Plan }
  | { kind: "addStop"; tripId: string; day: number; ref: StopRef; label: string }
  | { kind: "removeStop"; tripId: string; day: number; stopId: string; label: string }
  | { kind: "moveStop"; tripId: string; from: number; to: number; stopId: string; label: string };

export interface Reply {
  /** The sentence. Always present. */
  text: string;
  /** Checkable lines under it — what it chose and why. */
  detail?: string[];
  /** Offered, never done. */
  proposal?: Proposal;
  /** Tappable follow-ups, because an empty input box asks nothing. */
  chips?: string[];
}

export interface ChatContext {
  /** The trip this conversation is about, when it was opened on one. */
  trip?: Trip;
  /** What the last plan was built from, so 「多一點美食」 has something to edit. */
  last?: PlanRequest;
  /** So a second plan for one city does not collide with the first. */
  existingTripIds: string[];
}

/** The three things a cold conversation should offer, by whether it has a trip. */
export const OPENERS = {
  fresh: ["花蓮三天兩夜", "想去台南玩兩天，想吃美食", "日月潭兩天，我要租車"],
  trip: ["第二天加一個夜市", "把最後一站拿掉", "多加一天"],
};

const DEFAULT_DAYS = 3;

const dayOf = (trip: Trip, n?: number) => trip.days.find((d) => d.n === n) ?? trip.days[0];

/** Every stop in a trip, with the day it sits on. */
function allStops(trip: Trip) {
  return trip.days.flatMap((d) => d.tracks.flatMap((t) => t.stops.map((s) => ({ s, day: d.n }))));
}

/** Find the stop that is this place, anywhere in the trip. */
function findStop(trip: Trip, poi: Poi) {
  return allStops(trip).find(({ s }) => viewOf(s)?.poi?.id === poi.id);
}

export function respond(intent: Intent, ctx: ChatContext): Reply {
  switch (intent.kind) {
    case "greeting":
      return {
        text: "在。想去哪裡，玩幾天？",
        chips: ctx.trip ? OPENERS.trip : OPENERS.fresh,
      };

    case "plan":
    case "refine":
      return planReply(intent, ctx);

    case "addStop":
      return addReply(intent, ctx);

    case "removeStop":
      return removeReply(intent, ctx);

    case "moveStop":
      return moveReply(intent, ctx);

    case "addDay":
    case "dropDay":
      return dayCountReply(intent, ctx);

    case "question":
      return questionReply(intent, ctx);

    default:
      return {
        /* The honest answer, and three sentences that work. A chat that
           improvises here is a chat nobody can predict. */
        text: "這句我不會。我看得懂的是這幾種：",
        detail: [
          "排行程 —「花蓮三天兩夜」",
          "改行程 —「第二天加七星潭」「把松園別館拿掉」",
          "問這個地方 —「這裡有日文導覽嗎」",
        ],
        chips: ctx.trip ? OPENERS.trip : OPENERS.fresh,
      };
  }
}

/* -------------------------------------------------------------------- plan */

function planReply(intent: Intent, ctx: ChatContext): Reply {
  const destId = intent.destId ?? ctx.last?.destId;
  if (!destId) {
    return {
      text: "要去哪個城市？",
      chips: ["花蓮", "台南", "日月潭"],
    };
  }

  const req: PlanRequest = {
    destId,
    days: intent.days ?? ctx.last?.days ?? DEFAULT_DAYS,
    /* A refinement adds to what was already asked for rather than replacing
       it — somebody who says 「多一點美食」 after asking for nature wants both,
       not a food-only trip. A fresh plan starts clean. */
    interests:
      intent.kind === "refine"
        ? unique([...(ctx.last?.interests ?? []), ...(intent.interests ?? [])])
        : (intent.interests ?? []),
    transport: intent.transport ?? ctx.last?.transport ?? "unsure",
  };

  const plan = generatePlan(req, ctx.existingTripIds);
  const name = BY_DEST[destId]?.name ?? destId;
  const stops = plan.trip.days.reduce(
    (n, d) => n + d.tracks.reduce((m, t) => m + t.stops.length, 0),
    0,
  );

  return {
    text:
      intent.kind === "refine"
        ? `改好了：${name} ${req.days} 天，${describe(req)}。`
        : `${name} ${req.days} 天，排了 ${stops} 個行程。`,
    /* The planner's own account of itself, unedited. If it says it left
       something out, that line appears here too. */
    detail: plan.reasons,
    proposal: { kind: "newTrip", plan },
    chips: ["多一點美食", "多加一天", "改成租車自駕"],
  };
}

const unique = <T,>(a: T[]) => [...new Set(a)];

function describe(req: PlanRequest): string {
  const bits: string[] = [];
  if (req.interests.length) {
    bits.push(req.interests.map((i) => INTEREST_LABELS[i as InterestId]).join("、"));
  }
  if (req.transport !== "unsure") bits.push(TRANSPORT_WORD[req.transport]);
  return bits.length ? bits.join("，") : "沒有特別偏好";
}

const TRANSPORT_WORD: Record<TransportId, string> = {
  transit: "搭大眾運輸",
  drive: "租車自駕",
  charter: "包車",
  walk: "以走路為主",
  unsure: "交通還沒決定",
};

/* --------------------------------------------------------------- edit trip */

/** Every edit needs a trip and a place. One message for both gaps. */
function needTripAndPoi(intent: Intent, ctx: ChatContext): Reply | null {
  if (intent.ambiguous?.length) {
    return {
      text: "你是說哪一個？",
      chips: intent.ambiguous.map((p) => p.name),
    };
  }
  if (!ctx.trip) {
    return {
      text: "要改哪一份行程？先從「行程」分頁打開它，再跟我說。",
      chips: OPENERS.fresh,
    };
  }
  if (!intent.poi) {
    return {
      text: "要哪一個地方？說出名字就可以，例如「七星潭」。",
      chips: OPENERS.trip,
    };
  }
  return null;
}

function addReply(intent: Intent, ctx: ChatContext): Reply {
  const gap = needTripAndPoi(intent, ctx);
  if (gap) return gap;
  const trip = ctx.trip!;
  const poi = intent.poi!;

  const already = findStop(trip, poi);
  if (already) {
    return {
      text: `${poi.name}已經在 Day ${already.day} 了。`,
      chips: OPENERS.trip,
    };
  }

  const day = dayOf(trip, intent.day).n;
  return {
    text: `要把${poi.name}加到 Day ${day} 嗎？`,
    detail: [`${poi.area} · 建議停留 ${poi.stayMin} 分`],
    proposal: {
      kind: "addStop",
      tripId: trip.id,
      day,
      ref: { kind: "poi", poiId: poi.id },
      label: `${poi.name} → Day ${day}`,
    },
  };
}

function removeReply(intent: Intent, ctx: ChatContext): Reply {
  const gap = needTripAndPoi(intent, ctx);
  if (gap) return gap;
  const trip = ctx.trip!;
  const poi = intent.poi!;

  const hit = findStop(trip, poi);
  if (!hit) {
    return { text: `這份行程裡沒有${poi.name}。`, chips: OPENERS.trip };
  }

  return {
    text: `要把${poi.name}從 Day ${hit.day} 拿掉嗎？`,
    proposal: {
      kind: "removeStop",
      tripId: trip.id,
      day: hit.day,
      stopId: hit.s.id,
      label: `Day ${hit.day} 移除 ${poi.name}`,
    },
  };
}

function moveReply(intent: Intent, ctx: ChatContext): Reply {
  const gap = needTripAndPoi(intent, ctx);
  if (gap) return gap;
  const trip = ctx.trip!;
  const poi = intent.poi!;

  const hit = findStop(trip, poi);
  if (!hit) return { text: `這份行程裡沒有${poi.name}。`, chips: OPENERS.trip };
  if (intent.day === undefined) {
    return { text: `要把${poi.name}移到第幾天？`, chips: trip.days.map((d) => `Day ${d.n}`) };
  }
  if (intent.day === hit.day) {
    return { text: `${poi.name}本來就在 Day ${hit.day}。`, chips: OPENERS.trip };
  }
  if (!trip.days.some((d) => d.n === intent.day)) {
    return { text: `這份行程只有 ${trip.days.length} 天。`, chips: OPENERS.trip };
  }

  return {
    text: `要把${poi.name}從 Day ${hit.day} 移到 Day ${intent.day} 嗎？`,
    proposal: {
      kind: "moveStop",
      tripId: trip.id,
      from: hit.day,
      to: intent.day,
      stopId: hit.s.id,
      label: `${poi.name}：Day ${hit.day} → Day ${intent.day}`,
    },
  };
}

/**
 * Changing the number of days.
 *
 * Handled by re-planning rather than by bolting an empty day onto the end,
 * because a day with nothing in it is not what anybody meant by 「多加一天」.
 * It needs the original request, which only exists after a plan in this same
 * conversation — an imported trip has no request behind it and says so.
 */
function dayCountReply(intent: Intent, ctx: ChatContext): Reply {
  if (!ctx.last) {
    return {
      text: "這個要從我排的行程開始才行。先跟我說想去哪、玩幾天。",
      chips: OPENERS.fresh,
    };
  }
  const days =
    intent.kind === "addDay"
      ? ctx.last.days + 1
      : (intent.days ?? Math.max(1, ctx.last.days - 1));

  return planReply(
    { kind: "refine", destId: ctx.last.destId, days, interests: [], transport: undefined },
    ctx,
  );
}

/* --------------------------------------------------------------- questions */

function questionReply(intent: Intent, ctx: ChatContext): Reply {
  const poi = intent.poi;
  if (!poi) {
    return {
      text: "你想問哪個地方？說出名字就可以。",
      chips: ctx.trip ? OPENERS.trip : OPENERS.fresh,
    };
  }

  const at = { lat: poi.lat, lng: poi.lng };
  const ctxNear = {
    at,
    destId: poi.destId,
    destName: BY_DEST[poi.destId]?.name ?? "",
    poiArea: poi.area,
    radiusM: 5000,
  };

  switch (intent.topic) {
    case "audio": {
      const langs = [...new Set(audiosFor(poi.id).map((a) => a.language))];
      if (!langs.length) return { text: `${poi.name}目前還沒有語音導覽。` };
      return {
        text: `${poi.name}有 ${langs.length} 種語言的語音導覽。`,
        detail: [langs.join("・")],
      };
    }
    case "rental": {
      const list = nearbyRentals(ctxNear);
      if (!list.length) return { text: `${poi.name} 5 公里內沒有租車據點。` };
      return {
        text: `${poi.name} 5 公里內有 ${list.length} 個租車據點。`,
        detail: list.slice(0, 3).map((r) => `${r.item.brand}・${r.item.pickup}`),
      };
    }
    case "food": {
      /* Real places ResoMap writes about, not shops it has signed — it has
         signed none, so the answer says that rather than listing demo ones. */
      const list = POIS.filter(
        (p) => p.kind === "food" && p.id !== poi.id && distance(poi, p) <= 5000,
      ).sort((a, b) => distance(poi, a) - distance(poi, b));
      if (!list.length)
        return { text: `ResoMap 還沒有合作餐廳，${poi.name} 5 公里內也還沒有收錄吃的地方。` };
      return {
        text: `ResoMap 還沒有合作餐廳。${poi.name} 5 公里內有 ${list.length} 個收錄的吃的地方：`,
        detail: list.slice(0, 3).map((p) => `${p.name}・${p.area}`),
      };
    }
    default:
      return {
        text: `${poi.name}的周邊推薦在景點頁的「探索附近」裡，有一日遊、住宿跟租車。`,
      };
  }
}
