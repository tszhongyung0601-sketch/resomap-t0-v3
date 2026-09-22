import { useSyncExternalStore } from "react";
import type { ProviderKind } from "../types";

/**
 * Who this device is, in three independent parts.
 *
 * The first version of this held a single `plan` enum — member / merchant /
 * guide / driver — which made a shop and a person the same kind of thing. It
 * was tidy and it was wrong: activating a merchant account silently switched
 * off somebody's guide identity, because the two were competing for one field.
 * A café that also runs walking tours is an ordinary business, not a data
 * conflict.
 *
 * So:
 *
 *   membership          what every traveller has. Free, and there is no other
 *                       value today; it is a field rather than an assumption so
 *                       a paid traveller tier does not need a migration.
 *   professionalRole    a *person* who sells their own time. `null`, `driver`
 *                       or `guide` — and the exclusivity lives in the field
 *                       itself, so there is no state where both are on and no
 *                       "switch off the other one" step anybody can forget.
 *   merchantMembership  a *business* with a storefront. Independent of the
 *                       above, because it is a different kind of account.
 *
 * Persisted, and it migrates the old single-`plan` shape on read — somebody who
 * opened the previous build should not lose what they set.
 */

const KEY = "resomap_v3_account";

export type Membership = "free";
export type MerchantMembership = "inactive" | "active";

export interface ProProfile {
  displayName: string;
  serviceArea: string;
  languages: string;
  intro: string;
  line: string;
  phone: string;
  price: string;
}

export interface AudioDraft {
  id: string;
  /** Not a real upload — the demo records that a file was chosen, not the file. */
  fileName: string;
  language: string;
  title: string;
  poiId: string;
  description: string;
  /** Epoch ms. */
  at: number;
  status: "review";
}

export interface Account {
  membership: Membership;
  professionalRole: ProviderKind | null;
  merchantMembership: MerchantMembership;
  profile: ProProfile;
  drafts: AudioDraft[];
}

/**
 * The starting profile.
 *
 * Deliberately filled in: an empty form is a worse demo than a filled one, and
 * every field here is editable on screen, so nothing in it can be mistaken for
 * a number the app computed.
 */
const DEFAULT_PROFILE: ProProfile = {
  displayName: "Star",
  serviceArea: "台北市、新北市、基隆、宜蘭、桃園",
  languages: "中文、English、日本語",
  intro:
    "熱愛分享在地故事與文化，擅長規劃客製化行程，用語音帶你深度認識每個景點的美好。",
  line: "",
  phone: "",
  price: "NT$ 3,000 – 8,000 / 半日",
};

const EMPTY: Account = {
  membership: "free",
  professionalRole: null,
  merchantMembership: "inactive",
  profile: DEFAULT_PROFILE,
  drafts: [],
};

/** The previous shape, so an existing device keeps what it had. */
interface LegacyAccount {
  plan?: "member" | "merchant" | "guide" | "driver";
}

function read(): Account {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Account> & LegacyAccount;

    const legacy = parsed.plan;
    const role: ProviderKind | null =
      parsed.professionalRole === "driver" || parsed.professionalRole === "guide"
        ? parsed.professionalRole
        : legacy === "driver" || legacy === "guide"
          ? legacy
          : null;

    return {
      membership: "free",
      professionalRole: role,
      merchantMembership:
        parsed.merchantMembership === "active" || legacy === "merchant"
          ? "active"
          : "inactive",
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
      drafts: Array.isArray(parsed.drafts)
        ? parsed.drafts.filter(
            (d): d is AudioDraft => Boolean(d) && typeof d.id === "string",
          )
        : [],
    };
  } catch {
    return EMPTY;
  }
}

let state: Account = read();
const watchers = new Set<() => void>();

function commit(next: Account) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Quota or private mode — never worth breaking a screen over. */
  }
  for (const fn of watchers) fn();
}

function subscribe(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

const snapshot = () => state;

export function useAccount(): Account {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* ------------------------------------------------------------------ reads */

export const isMerchant = (a: Account) => a.merchantMembership === "active";
export const isProfessional = (a: Account) => a.professionalRole !== null;

/** Whether this account sells anything at all — drives one row in 我的. */
export const sellsSomething = (a: Account) => isMerchant(a) || isProfessional(a);

/* ----------------------------------------------------------------- writes */

/**
 * Take on, or put down, a professional identity.
 *
 * One assignment. Driver and guide cannot both be true because there is one
 * field, and passing `null` is how somebody stops being either — which the
 * previous single-enum version had no way to express at all.
 */
export function setProfessionalRole(role: ProviderKind | null) {
  commit({ ...state, professionalRole: role });
}

/** Independent of the above. A shop owner may also be a guide. */
export function setMerchantMembership(active: boolean) {
  commit({ ...state, merchantMembership: active ? "active" : "inactive" });
}

export function saveProfile(patch: Partial<ProProfile>) {
  commit({ ...state, profile: { ...state.profile, ...patch } });
}

export function addDraft(d: Omit<AudioDraft, "id" | "at" | "status">) {
  commit({
    ...state,
    drafts: [
      { ...d, id: `draft-${Date.now()}`, at: Date.now(), status: "review" },
      ...state.drafts,
    ],
  });
}

export function removeDraft(id: string) {
  commit({ ...state, drafts: state.drafts.filter((d) => d.id !== id) });
}

/** The demo reset clears this too — see App.tsx's reset(). */
export const resetAccount = () => commit(EMPTY);
