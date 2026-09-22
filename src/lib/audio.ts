import { AUDIO_GUIDES } from "../data/audio";
import { STORIES } from "../data/stories";
import { estimateSeconds, formatClock, splitSentences } from "./speech";
import type { AudioGuide, Story } from "../types";

/**
 * One list per place, assembled from two sources that must never be merged in
 * the data itself.
 *
 * ResoMap's own fifteen guides live in data/stories.ts and are lifted into
 * AudioGuide shape here, at read time. Copying them into data/audio.ts would
 * have been three lines shorter and would have given every guide two homes —
 * and the first edit to one of them would have produced two different texts
 * under one title, on two screens, with no way to tell which was current.
 *
 * The ordering is the product decision this module exists to hold:
 *
 *   1. 店家精選 — at most two, in the merchant's chosen order.
 *   2. ResoMap 的導覽 — the commissioned guide, when this place has one.
 *   3. 旅人上傳 — everything else, most played first.
 *
 * The cap of two is enforced here rather than trusted to the data. A merchant
 * who buys the top of a page will eventually try to buy more of it, and the
 * place to say no is in code.
 */

export const FEATURED_CAP = 2;

/** The one language the demo genuinely has ResoMap recordings in. */
export const HOME_LANGUAGE = "中文";

/**
 * A guide's language as a BCP-47 tag, so the browser can try to speak it.
 *
 * This is not decoration: `lib/speech.ts` picks a voice from this, and a device
 * with a Japanese voice installed really does read the 日本語 guides aloud. Where
 * no voice exists the player falls back to 字幕模式 — the same behaviour T0
 * already had, now reachable in eight languages instead of one.
 */
const SPEECH_LANG: Record<string, string> = {
  中文: "zh-TW",
  English: "en-US",
  日本語: "ja-JP",
  한국어: "ko-KR",
  ไทย: "th-TH",
  "Bahasa Indonesia": "id-ID",
  Filipino: "fil-PH",
  "Tiếng Việt": "vi-VN",
  Français: "fr-FR",
};

export const speechLang = (language: string) => SPEECH_LANG[language] ?? "zh-TW";

/** ResoMap's own guide, in the shape the list renders. */
function fromStory(s: Story): AudioGuide {
  return {
    id: `au-${s.id}`,
    poiId: s.poiId,
    kind: "resomap",
    title: s.title,
    hook: s.hook,
    narrator: s.narrator,
    language: HOME_LANGUAGE,
    minutes: s.minutes,
    /* The nominal length, which is what every other surface in the app prints
       for this guide — the POI card says 聽 3 分鐘 and 導覽庫 says 3 分鐘. The
       progress bar still runs on lib/speech.ts's estimate of the script, and
       the player shows both, exactly as T0 already did. Deriving the row's
       clock from the estimate instead would have put 00:49 next to a button
       promising three minutes, on adjacent screens. */
    clock: formatClock(s.minutes * 60),
    plays: s.plays,
    likes: s.likes,
    body: s.body,
  };
}

const DERIVED: AudioGuide[] = STORIES.map(fromStory);

/**
 * Every guide in the app, ResoMap's and everybody else's.
 *
 * V3 leaves out the merchant recordings. Each one is a shop speaking about
 * itself under 店家精選, and there is no shop — ResoMap has not signed any. The
 * records stay in data/audio.ts for when there is one.
 */
export const ALL_AUDIO: AudioGuide[] = [
  ...DERIVED,
  ...AUDIO_GUIDES.filter((a) => a.kind !== "merchant"),
];

const BY_ID: Record<string, AudioGuide> = Object.fromEntries(
  ALL_AUDIO.map((a) => [a.id, a]),
);

export const audio = (id: string): AudioGuide | undefined => BY_ID[id];

/**
 * The pinned block: a paying merchant's own recordings, capped at two.
 *
 * Sorted by the merchant's own `featuredOrder`, then by id so the order is
 * total — two records that both claim to be first would otherwise shuffle
 * between renders, which on a paid placement is a support ticket.
 */
export function featuredAudiosFor(poiId: string): AudioGuide[] {
  return ALL_AUDIO.filter((a) => a.poiId === poiId && a.kind === "merchant")
    .sort(
      (a, b) =>
        (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99) || a.id.localeCompare(b.id),
    )
    .slice(0, FEATURED_CAP);
}

/** Everything that is not pinned: ResoMap's guide first, then uploads. */
export function ordinaryAudiosFor(poiId: string): AudioGuide[] {
  const rest = ALL_AUDIO.filter((a) => a.poiId === poiId && a.kind !== "merchant");
  const mine = rest.filter((a) => a.kind === "resomap");
  const theirs = rest.filter((a) => a.kind === "community").sort((a, b) => b.plays - a.plays);
  return [...mine, ...theirs];
}

/** The whole list, in the order the screen shows it. */
export function audiosFor(poiId: string): AudioGuide[] {
  return [...featuredAudiosFor(poiId), ...ordinaryAudiosFor(poiId)];
}

export const audioCount = (poiId: string) => audiosFor(poiId).length;

/**
 * Whether a place has anything to listen to at all.
 *
 * Deliberately not the same question as `hasStory` in lib/story.ts. That one
 * asks whether ResoMap recorded here, and it is what the home map's two pin
 * colours mean — changing it would change a screen that is meant to stay
 * exactly as it is. This one asks whether the traveller standing here has
 * headphones-worth of anything, which is what the 地圖 tab and the POI page
 * want to know: 饒河街 has six guides and no ResoMap recording.
 */
export const hasAudio = (poiId: string) => audiosFor(poiId).length > 0;

/** Which languages this place can be heard in, ResoMap's language first. */
export function languagesFor(poiId: string): string[] {
  const seen = new Set(audiosFor(poiId).map((a) => a.language));
  return [...seen].sort((a, b) =>
    a === HOME_LANGUAGE ? -1 : b === HOME_LANGUAGE ? 1 : a.localeCompare(b),
  );
}

/**
 * The 「03:42」 on a row — the guide's own length, as its author states it.
 *
 * Not the same number as the progress bar's total, and it is not meant to be:
 * the bar runs on lib/speech.ts's estimate of how long the transcript takes to
 * synthesise, which is a property of this demo having no recorded audio. The
 * row states the recording's length; the player shows both, exactly as T0
 * already did with 「3 分鐘」 above a bar that ends at 00:49.
 *
 * Falls back to the estimate only for a guide whose author gave no length.
 */
export function clockOf(a: AudioGuide): string {
  if (a.clock) return a.clock;
  const total = splitSentences(a.body).reduce((sum, s) => sum + estimateSeconds(s), 0);
  return formatClock(total);
}

/**
 * Title search across a place's list.
 *
 * Matches the title, the hook and the narrator, because 「Rosalie」 and
 * 「日本語」 are both things somebody types into a box above a list of guides.
 * Case-folded; no fuzzy matching, because a search that returns something for
 * every typo is a search nobody can use to prove a guide is absent.
 */
export function searchAudios(list: AudioGuide[], q: string): AudioGuide[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((a) =>
    [a.title, a.hook, a.narrator, a.language].join(" ").toLowerCase().includes(needle),
  );
}
