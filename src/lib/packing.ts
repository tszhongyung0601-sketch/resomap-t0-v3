import { useSyncExternalStore } from "react";
import { dest } from "../data/destinations";
import { load, save } from "./persist";
import { refOf, viewOf } from "./stop";
import { hasAudio } from "./audio";
import { resolveDate, type DayWeather } from "./weather";
import type { Trip } from "../types";

/**
 * 行李清單 — written from the trip, not from a template.
 *
 * Every item that is not universal carries the reason it is there, in the
 * trip's own terms: 「第 2 天可能下雨」, 「行程有北投」. A list that says why is
 * a list somebody can argue with, and a list somebody can argue with is one
 * they actually read. The traveller can tick, add and remove; what the trip
 * implies is recomputed every time, so adding a hot spring on Day 3 puts 泳衣
 * on the list without anyone touching it.
 */

export type PackGroup = "證件與錢" | "衣物" | "盥洗與藥品" | "電子產品" | "這趟特別需要" | "我加的";

export const PACK_GROUPS: PackGroup[] = ["證件與錢", "衣物", "盥洗與藥品", "電子產品", "這趟特別需要", "我加的"];

export interface PackItem {
  id: string;
  label: string;
  group: PackGroup;
  /** Why this trip needs it. Absent for the things every trip needs. */
  why?: string;
}

/* Places whose kind of day changes what goes in the bag. By id, because the
   POI records have no "hot spring" or "beach" field and inventing one for
   eight rows would be a schema change for a checklist. */
const HOT_SPRING = new Set(["beitou", "jiaoxi"]);
const SEASIDE = new Set(["qixingtan", "cijin", "kenting", "shuishe-pier", "fort-domingo"]);
const MOUNTAIN = new Set(["taroko", "shakadang", "hemeishan", "elephant-mtn", "maokong", "alishan"]);

/** WMO weather codes that mean something is falling. */
const WET = (w: DayWeather) =>
  (w.popPct ?? 0) >= 50 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 99);

export function packingFor(trip: Trip, sky: Map<string, DayWeather> | null): PackItem[] {
  const abroad = (dest(trip.destId)?.country ?? "tw") !== "tw";
  const nights = Math.max(1, trip.days.length - 1);
  const stops = trip.days.flatMap((d) => d.tracks.flatMap((t) => t.stops));
  const pois = stops.map((s) => viewOf(s)?.poi).filter((p) => p !== undefined);
  const names = (set: Set<string>) =>
    [...new Set(pois.filter((p) => set.has(p.id)).map((p) => p.name))].slice(0, 2).join("、");

  const items: PackItem[] = [
    { id: "id", label: abroad ? "身分證（回國用）" : "身分證、健保卡", group: "證件與錢" },
    { id: "wallet", label: "錢包、信用卡", group: "證件與錢" },
    { id: "clothes", label: `換洗衣物 ${nights} 套`, group: "衣物", why: `${trip.days.length} 天 ${nights} 夜` },
    { id: "sleep", label: "睡衣", group: "衣物" },
    { id: "toiletry", label: "牙刷、牙膏、洗面乳", group: "盥洗與藥品" },
    { id: "meds", label: "常備藥品", group: "盥洗與藥品" },
    { id: "phone", label: "手機、充電線", group: "電子產品" },
    { id: "power", label: "行動電源", group: "電子產品" },
  ];

  if (abroad) {
    items.push(
      { id: "passport", label: "護照（效期六個月以上）", group: "證件與錢", why: "出國" },
      { id: "cash", label: "外幣現金", group: "證件與錢", why: "出國，小店不一定能刷卡" },
      { id: "plug", label: "轉接頭", group: "電子產品", why: "出國" },
      { id: "esim", label: "eSIM 或網卡", group: "電子產品", why: "出國" },
      { id: "insurance", label: "旅平險保單", group: "證件與錢", why: "出國" },
    );
  }

  /* Rain, from the same forecast the day cards show. */
  const wet = trip.days
    .filter((d) => {
      const iso = resolveDate(d.date);
      const w = iso ? sky?.get(iso) : undefined;
      return w ? w.forecast && WET(w) : false;
    })
    .map((d) => d.n);
  if (wet.length) {
    items.push({
      id: "rain",
      label: "雨具（折疊傘或輕便雨衣）",
      group: "這趟特別需要",
      why: `第 ${wet.join("、")} 天可能下雨`,
    });
  }

  /* Driving: a hire counter in the plan, or a day set to 開車 / 機車. */
  const driving =
    stops.some((s) => refOf(s).kind === "rental") ||
    trip.days.some((d) => d.mode === "drive" || d.mode === "scooter");
  if (driving) {
    items.push({
      id: "licence",
      label: abroad ? "國際駕照＋台灣駕照正本" : "駕照",
      group: "證件與錢",
      why: "行程裡有租車或騎車",
    });
  }

  const spring = names(HOT_SPRING);
  if (spring) items.push({ id: "swim", label: "泳衣、毛巾", group: "這趟特別需要", why: `行程有${spring}` });

  const sea = names(SEASIDE);
  if (sea) items.push({ id: "sun", label: "防曬、太陽眼鏡", group: "這趟特別需要", why: `行程有${sea}` });

  const hill = names(MOUNTAIN);
  if (hill) {
    items.push(
      { id: "jacket", label: "保暖外套", group: "這趟特別需要", why: `行程有${hill}，山上比較冷` },
      { id: "shoes", label: "好走的鞋", group: "這趟特別需要", why: `行程有${hill}` },
    );
  }

  if (pois.some((p) => hasAudio(p.id))) {
    items.push({ id: "earphones", label: "耳機", group: "電子產品", why: "行程裡有語音導覽" });
  }

  return items;
}

/* ------------------------------------------------------------- the ticks */

interface PackState {
  checked: string[];
  added: { id: string; label: string }[];
  removed: string[];
}

type Store = Record<string, PackState>;

const KEY = "resomap_v3_packing";
let store: Store = load<Store>(KEY, {});
const watchers = new Set<() => void>();

const EMPTY: PackState = { checked: [], added: [], removed: [] };

function commit(tripId: string, next: PackState) {
  store = { ...store, [tripId]: next };
  save(KEY, store);
  for (const w of watchers) w();
}

const subscribe = (fn: () => void) => {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
};

export function usePacking(trip: Trip, sky: Map<string, DayWeather> | null) {
  const all = useSyncExternalStore(subscribe, () => store);
  const state = all[trip.id] ?? EMPTY;
  const items = [
    ...packingFor(trip, sky).filter((i) => !state.removed.includes(i.id)),
    ...state.added.map((a) => ({ id: a.id, label: a.label, group: "我加的" as const })),
  ];
  const done = items.filter((i) => state.checked.includes(i.id)).length;

  return {
    items,
    done,
    isChecked: (id: string) => state.checked.includes(id),
    toggle: (id: string) =>
      commit(trip.id, {
        ...state,
        checked: state.checked.includes(id)
          ? state.checked.filter((x) => x !== id)
          : [...state.checked, id],
      }),
    add: (label: string) => {
      const text = label.trim();
      if (!text) return;
      commit(trip.id, { ...state, added: [...state.added, { id: `mine-${Date.now()}`, label: text }] });
    },
    remove: (id: string) =>
      commit(trip.id, {
        checked: state.checked.filter((x) => x !== id),
        added: state.added.filter((a) => a.id !== id),
        removed: id.startsWith("mine-") ? state.removed : [...state.removed, id],
      }),
    restore: () => commit(trip.id, { ...state, removed: [] }),
    hidden: state.removed.length,
  };
}
