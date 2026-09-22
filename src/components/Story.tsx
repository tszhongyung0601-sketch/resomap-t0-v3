import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { poi } from "../data";
import { story } from "../data/stories";
import { audio as audioById, clockOf, speechLang } from "../lib/audio";
import { toggleStory, useSaved } from "../lib/saved";
import {
  addComment,
  commentsFor,
  likeCount,
  toggleDislike,
  toggleLike,
  useReactions,
} from "../lib/reactions";
import { createPlayer, formatClock, splitSentences, type VoicePlayer } from "../lib/speech";
import { track } from "../lib/track";
import { Button, Headphones, Segmented, Sheet, Tag } from "./ui";
import { PoiImage, PoiThumb } from "./Cover";
import { getNearbyCountUnit, nearbyCounts } from "../lib/nearby";
import { BY_DEST } from "../data/destinations";
import type { NearbyCat } from "../data/nearbyCategories";
import type { StoryLength } from "../types";

/** The one language ResoMap has actually recorded. Everything else is text. */
const SPOKEN = "中文";

/**
 * Arrival prompt.
 *
 * This is the only place the voice guide announces itself unprompted, and it
 * only fires once you are standing in front of the thing. A story about 赤崁樓
 * is worth three minutes when you can see the banyan tree it describes; on the
 * home screen it is just another card asking for attention.
 *
 * It offers both edits rather than one 開始播放, because somebody who has just
 * arrived is usually still walking. Thirty seconds is an offer they can accept
 * mid-stride; three minutes is a decision, and burying it behind a play button
 * is how it turns into an abandonment.
 */
export function ArrivalSheet({
  poiId,
  onPlay,
  onLater,
}: {
  poiId: string;
  onPlay: (length: StoryLength) => void;
  onLater: () => void;
}) {
  const p = poi(poiId);
  const s = story(p?.storyId);
  /* This sheet does NOT record story_play. It used to, on mount — so showing
     the prompt counted as a play even when the traveller tapped 稍後, while the
     POI page's own 30 秒 / 完整故事 buttons went straight to the player and were
     never counted at all. The funnel that came out could report more finishes
     than plays. The event belongs at the one point every route converges on:
     audio actually starting, in StoryPlayer. */
  if (!p || !s) return null;

  return (
    <Sheet open onClose={onLater}>
      <div className="px-5 pb-2 pt-2">
        <div className="flex items-center gap-3">
          <PoiThumb poi={p} size={56} />
          <div>
            <div className="text-[13px] text-ink-3">你到了</div>
            <div className="text-[19px] font-bold text-ink">{p.name}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-surface p-4">
          <span className="text-[20px]">🎧</span>
          <div className="min-w-0 flex-1">
            {/* Title only. It already ends with the hook, and a sheet that
                says the same sentence twice reads like a rendering bug. */}
            <div className="truncate text-[14.5px] font-semibold text-ink">{s.title}</div>
            <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{s.narrator}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onPlay("short")}
            className="num inline-flex h-13 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-surface px-3 text-[14px] font-bold text-ink active:bg-surface-2"
          >
            30 秒快速聽
          </button>
          <button
            onClick={() => onPlay("full")}
            className="num inline-flex h-13 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-brand px-3 text-[14px] font-bold text-white active:bg-brand-press"
          >
            聽 {s.minutes} 分鐘完整故事
          </button>
        </div>
        <div className="mt-1">
          <Button variant="ghost" onClick={onLater}>
            稍後
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * The player. One of them, for every guide in the app.
 *
 * It plays two things that used to want two components, and does not become two
 * components:
 *
 *  · **A ResoMap story** (`poiId` + `length`) — the fifteen commissioned guides,
 *    cut twice. Keeps the 快速聽 / 完整故事 toggle, the language list and the
 *    "this language has no recording" behaviour exactly as they were.
 *  · **Any other guide** (`audioId`) — a merchant's recording or a traveller's
 *    upload. One edit, one language, so no toggle and no language list: a
 *    control with a single option is a control that teaches nothing.
 *
 * What both get: a real attempt at speech in the guide's own language. A 日本語
 * upload is handed to `lib/speech.ts` as `ja-JP`, and a device with a Japanese
 * voice reads it aloud. Where no voice exists it runs as subtitles on the same
 * clock and says 字幕模式 — which is the behaviour T0 already had for one
 * language, now reachable in eight.
 *
 * Two things it stays honest about. The length toggle rebuilds the player
 * rather than skipping ahead, because the 30 秒 edit is a different recording,
 * not a truncation. And a language with no recording says so rather than
 * quietly speaking 中文 under a label that claims otherwise.
 *
 * Reactions (♥ / 不推 / 留言) are keyed by the guide's id — `au-${storyId}` for
 * a ResoMap story — so a heart set in the list is already set when the player
 * opens, and vice versa. There is no second copy to drift.
 */
export function StoryPlayer({
  poiId,
  length = "full",
  audioId,
  onExplore,
  onClose,
}: {
  poiId: string;
  length?: StoryLength;
  /** Set for anything that is not one of ResoMap's own fifteen guides. */
  audioId?: string;
  /**
   * Where a finished guide goes next.
   *
   * `cat` omitted opens 周邊推薦 itself; given, it opens that one list. The
   * traveller who has just heard three minutes about a night market already
   * knows they want food — making them walk through a hub screen to say so is
   * a step that exists only because the app is organised that way.
   */
  onExplore?: (poiId: string, cat?: NearbyCat) => void;
  onClose: () => void;
}) {
  const p = poi(poiId);
  const s = story(p?.storyId);
  const guide = audioId ? audioById(audioId) : undefined;
  /** Story mode when no `audioId` was handed in. */
  const storyMode = !audioId;

  const [len, setLen] = useState<StoryLength>(length);
  /* Asked for a different edit while the player is already open — arriving at a
     second place, say. Without this the toggle keeps the previous choice and
     plays an edit nobody picked. */
  useEffect(() => setLen(length), [length, poiId]);

  const [lang, setLang] = useState(() => guide?.language ?? s?.languages[0] ?? SPOKEN);
  /* The same reset as `len` above, for the same reason. Somebody who switched to
     日本語 to read the transcript at one place arrived at the next one still on
     日本語: no autoplay, and a recording that does exist sitting behind a line
     saying it does not. */
  useEffect(() => {
    setLang(guide?.language ?? s?.languages[0] ?? SPOKEN);
  }, [poiId, s, guide]);

  /**
   * Whether this player can produce sound at all.
   *
   * In story mode it means "the traveller is on the one language ResoMap
   * recorded". In guide mode the guide *is* its language, so it is always true
   * and the fallback is `player.silent` — no voice installed — which the UI
   * already labels 字幕模式.
   */
  const spoken = storyMode ? lang === SPOKEN : true;
  /* Read inside the player-building effect, which must not re-run on a language
     change — rebuilding there would restart an edit the traveller is midway
     through just because they looked at the language list. */
  const spokenRef = useRef(spoken);
  spokenRef.current = spoken;

  /* One story_play per edit that actually produced audio, whether it started on
     its own or the traveller pressed ▶. Reset with each rebuilt player, so
     story_finish can never outrun the play it belongs to. */
  const countedRef = useRef(false);

  const sentences = useMemo(() => {
    if (guide) return splitSentences(guide.body);
    return s ? splitSentences(len === "short" ? s.short : s.body) : [];
  }, [s, len, guide]);

  /** BCP-47 for whatever is being read. */
  const bcp47 = guide ? speechLang(guide.language) : "zh-TW";

  const [player, setPlayer] = useState<VoicePlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  /** Set when the guide runs to the end — the one moment 探索附近 is earned. */
  const [finished, setFinished] = useState(false);
  /* The transcript's job is done once the guide has ended; the panel takes its
     place rather than being squeezed above it. Reversible, because somebody may
     have finished listening and still want to read a sentence back. */
  const [showNext, setShowNext] = useState(false);
  const [sheet, setSheet] = useState<"comments" | null>(null);
  /* Shared and persisted, keyed by story id — 收藏 reads the same list. */
  /* Hook first, question after: putting useSaved() behind `s &&` makes it a
     conditional call, and the hook order changes the moment a story is
     missing. Read the list unconditionally, then ask about it. */
  const savedStories = useSaved().stories;
  const saved = Boolean(s && savedStories.includes(s.id));
  const [copied, setCopied] = useState(false);

  /** The id reactions are stored under. Story mode borrows its derived guide. */
  const reactionId = audioId ?? (s ? `au-${s.id}` : `poi-${poiId}`);
  const reactions = useReactions();
  const liked = reactions.liked.includes(reactionId);
  const disliked = reactions.disliked.includes(reactionId);
  const comments = commentsFor(reactions.comments, reactionId);

  useEffect(() => {
    if (!sentences.length) return;
    const v = createPlayer(
      sentences,
      {
        onSentence: setLine,
        onTick: setElapsed,
        onEnd: () => {
          setPlaying(false);
          setFinished(true);
          setShowNext(true);
          track("story_finish", { poiId });
        },
      },
      bcp47,
    );
    setPlayer(v);
    setLine(0);
    setElapsed(0);
    setFinished(false);
    setShowNext(false);
    countedRef.current = false;
    // Autoplay: they already picked an edit to get here.
    if (spokenRef.current) {
      v.play();
      setPlaying(true);
      countedRef.current = true;
      track("story_play", { poiId });
    } else {
      setPlaying(false);
    }
    return () => {
      v.stop();
      setPlayer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences, bcp47]);

  /* Selecting a language nobody has recorded stops the audio. Leaving 中文
     playing underneath would be the app lying about what you are hearing. */
  useEffect(() => {
    if (spoken || !player) return;
    player.pause();
    setPlaying(false);
  }, [spoken, player]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!p) return null;
  if (storyMode && !s) return null;
  if (!storyMode && !guide) return null;

  const total = player?.totalSeconds ?? 0;
  const pct = total ? Math.min(100, (elapsed / total) * 100) : 0;
  const lengthLabel = guide
    ? clockOf(guide)
    : len === "short"
      ? "30 秒"
      : `${s!.minutes} 分鐘`;
  const langs = storyMode ? (s!.languages.length ? s!.languages : [SPOKEN]) : [lang];
  const title = guide ? guide.title : s!.title;
  const narrator = guide ? guide.narrator : s!.narrator;
  const plays = guide ? guide.plays : s!.plays;
  const authoredLikes = guide ? guide.likes : s!.likes;
  const shareText = `${title}｜ResoMap 語音導覽`;

  function cycleLang() {
    const at = langs.indexOf(lang);
    setLang(langs[(at + 1) % langs.length]);
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
      } catch {
        /* dismissed — not an error worth surfacing */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setCopied(true);
    } catch {
      /* clipboard blocked; nothing useful to say about it */
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg">
      {/* The place, photographed where there is a photograph of it. `PoiImage`
          falls back to the tinted emoji panel for the POIs that have none, so
          this is the same header it always was wherever no picture exists — and
          a real one everywhere a real one has been sourced. */}
      <div className="relative h-[30%] shrink-0">
        <PoiImage
          poi={p}
          height="100%"
          radius={0}
          large
          className="absolute inset-0"
        />
        {/* 44px, matching the back button on the POI page. At size-10 this was
            40px — the one way out of a full-screen overlay, and the smallest
            target in the app. */}
        <button
          onClick={onClose}
          aria-label="關閉"
          className="absolute left-4 top-4 grid size-11 place-items-center rounded-full bg-bg/90 text-[17px] text-ink active:bg-bg"
        >
          ✕
        </button>
        {/* Which place this guide belongs to, on the guide's own picture. In
            guide mode the title is about a shop or a language, so without this
            the screen never names the spot the traveller is standing in. */}
        <span className="absolute bottom-3 left-4 max-w-[70%] truncate rounded-md bg-bg/85 px-2 py-1 text-[12px] font-semibold text-ink-2">
          {p.name}
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-4">
        <div className="flex items-center gap-2">
          {/* Same trick as Chip: the pill stays small and the pseudo-element
              carries the target. */}
          <button
            onClick={cycleLang}
            disabled={langs.length < 2}
            aria-label="切換語言"
            className="relative inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11.5px] font-semibold text-ink-2 after:absolute after:inset-x-0 after:-inset-y-[13px] after:content-['']"
          >
            {lang}
            {langs.length > 1 && <span className="text-ink-3">▾</span>}
          </button>
          {spoken && player?.silent && (
            <span className="rounded-md bg-surface px-2 py-1 text-[11.5px] font-semibold text-ink-3">
              字幕模式
            </span>
          )}
          {guide?.kind === "merchant" && (
            <span className="rounded-md bg-brand-wash px-2 py-1 text-[11.5px] font-semibold text-brand">
              店家精選
            </span>
          )}
        </div>

        {/* Naming the language the transcript is actually in is the whole point.
            "先看文字稿" next to a 日本語 label promises a Japanese transcript,
            and in story mode what renders underneath is `s.body` — 中文, every
            time. In guide mode the text really is in that language, so this
            notice does not appear at all. */}
        {storyMode && !spoken && (
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            {lang}的錄音還在製作中，以下是{SPOKEN}文字稿。
          </p>
        )}
        {!storyMode && player?.silent && (
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            這台裝置沒有安裝{lang}的語音，改用字幕模式播放。
          </p>
        )}

        <h1 className="mt-2 line-clamp-2 text-[18px] font-bold leading-snug text-ink">
          {title}
        </h1>

        <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-3">
          <span className="num shrink-0">{lengthLabel}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{narrator}</span>
        </div>

        {/* Play counts are the one number in this app that could be mistaken
            for traction. There is none — so the label goes next to them. */}
        <div className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-3">
          <span className="num shrink-0">{plays.toLocaleString()} 次播放</span>
          <Tag kind="demo" />
          {storyMode && (
            <button
              onClick={() => s && toggleStory(s.id)}
              aria-pressed={saved}
              className={`ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${
                saved ? "bg-surface-2 text-ink" : "bg-surface text-ink-2 active:bg-surface-2"
              }`}
            >
              <span aria-hidden>{saved ? "♥" : "♡"}</span>
              {saved ? "已收藏" : "收藏"}
            </button>
          )}
        </div>

        {/* Height reserved so the confirmation cannot shove the player about. */}
        <div className="mt-0.5 h-4 text-[11.5px] text-ink-3">
          {copied && <span className="rm-in">已複製連結</span>}
        </div>

        {storyMode && (
          <div className="mt-1">
            <Segmented<StoryLength>
              items={[
                { id: "short", label: "快速聽" },
                { id: "full", label: "完整故事" },
              ]}
              value={len}
              onChange={setLen}
            />
          </div>
        )}

        {spoken ? (
          <>
            {/* A real button, not a div with an onClick: this was the only
                control on the screen with no keyboard path and nothing for a
                screen reader to announce. The padding is vertical only — the
                click maths reads this element's own rect, so any horizontal
                padding would offset every seek by its width. */}
            <button
              type="button"
              aria-label="跳到導覽的某一句"
              className="mt-2 w-full cursor-pointer px-0 py-4"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                player?.seekSentence(
                  Math.floor(((e.clientX - r.left) / r.width) * sentences.length),
                );
              }}
            >
              <div className="relative h-1 rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand"
                  style={{ width: `${pct}%`, transition: "width .12s linear" }}
                />
              </div>
            </button>
            <div className="num flex justify-between text-[11.5px] text-ink-3">
              <span>{formatClock(elapsed)}</span>
              <span>{formatClock(total)}</span>
            </div>

            {/* The two seek buttons were bare text — about 30×16px of tappable
                area each, sitting either side of a 64px play button. They get a
                real 44px target; `size-11` holds it without changing how they
                look. */}
            <div className="mt-3 flex items-center justify-center gap-8">
              <button
                onClick={() => player?.seekSeconds(-10)}
                aria-label="倒轉 10 秒"
                className="grid size-11 place-items-center rounded-full text-[13px] font-bold text-ink-2 active:bg-surface"
              >
                ↺ 10
              </button>
              <button
                onClick={() => {
                  if (!player) return;
                  if (playing) {
                    player.pause();
                    setPlaying(false);
                  } else {
                    setFinished(false);
                    setShowNext(false);
                    player.play();
                    setPlaying(true);
                    if (!countedRef.current) {
                      countedRef.current = true;
                      track("story_play", { poiId });
                    }
                  }
                }}
                aria-label={playing ? "暫停" : "播放"}
                className="grid size-16 place-items-center rounded-full bg-brand text-[22px] text-white active:bg-brand-press"
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                onClick={() => player?.seekSeconds(10)}
                aria-label="快轉 10 秒"
                className="grid size-11 place-items-center rounded-full text-[13px] font-bold text-ink-2 active:bg-surface"
              >
                10 ↻
              </button>
            </div>
          </>
        ) : (
          /* No transport controls for an edit that cannot play — a disabled
             play button is still a play button. */
          <div className="mt-4 flex items-center gap-1.5 text-[12.5px] text-ink-3">
            <Headphones size={13} />
            {SPOKEN}版本可以播放
          </div>
        )}

        {/* 讚 / 不推 / 留言 / 分享.
            One row, four equal pills, because they are four opinions of the same
            weight. Like and dislike are one opinion with two directions — the
            store clears the other, so both can never be lit at once. */}
        <div className="mt-3 flex gap-2">
          <ActionPill
            active={liked}
            label={`${likeCount(authoredLikes, liked).toLocaleString()}`}
            icon={liked ? "♥" : "♡"}
            onClick={() => toggleLike(reactionId)}
            aria="喜歡"
          />
          <ActionPill
            active={disliked}
            label="不推"
            icon="⌄"
            onClick={() => toggleDislike(reactionId)}
            aria="不推薦"
          />
          <ActionPill
            label={comments.length ? `${comments.length}` : "留言"}
            icon="💬"
            onClick={() => setSheet("comments")}
            aria="留言"
          />
          <ActionPill label="分享" icon="↗" onClick={share} aria="分享" />
        </div>

        {/* The hand-off. It appears when the guide has actually run to the end,
            never on open — an offer to go shopping, printed before anybody has
            listened to anything, is an advert.

            A question with five answers rather than one button, because by this
            point the traveller has a specific appetite. Each row goes straight
            to that list; only the rows with something behind them within 5 km
            are offered. */}
        {showNext && onExplore ? (
          <NextUp
            poiId={poiId}
            placeName={p.name}
            onExplore={onExplore}
            onTranscript={() => setShowNext(false)}
          />
        ) : (
          <>
            {finished && onExplore && (
              <button
                onClick={() => setShowNext(true)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-surface text-[13.5px] font-bold text-ink active:bg-surface-2"
              >
                接下來想做什麼？
              </button>
            )}
            <div className="mt-3 flex-1 overflow-y-auto no-scrollbar">
              {sentences.map((t, i) => (
                <p
                  key={i}
                  className={`mb-2 text-[14.5px] leading-[1.8] transition ${
                    i === line && playing ? "font-semibold text-ink" : "text-ink-3"
                  }`}
                >
                  {t}
                </p>
              ))}
              <div className="h-4" />
            </div>
          </>
        )}
      </div>

      {/* Rendered inside the player rather than through `Sheet`.
          `Sheet` portals to the shell's overlay host, which sits *below* this
          full-screen z-50 layer — a comment box that opens behind the player it
          was opened from. Inside the player's own stacking context it lands
          where it was asked for. */}
      {sheet === "comments" && (
        <PlayerSheet title="留言" onClose={() => setSheet(null)}>
          <CommentBox
            audioId={reactionId}
            comments={comments}
            onClose={() => setSheet(null)}
          />
        </PlayerSheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * 「接下來想做什麼？」 — the moment the whole product hangs on.
 *
 * A guide creates an appetite; this is where it gets answered. Five specific
 * answers rather than one 探索附近, because somebody who has just heard about a
 * night market wants food, and routing them through a hub screen to say so is a
 * step that exists only because the app is organised that way.
 *
 * Only rows with something behind them at 5 km are offered — the counts come
 * from the same `nearbyCounts` the 周邊推薦 screen uses, so a row that appears
 * here cannot open an empty list. When nothing at all is nearby the panel says
 * that instead of listing five dead ends.
 */
/* V3: no merchants, drivers or guides — ResoMap has signed none yet. The
   three doors left are the ones 周邊推薦 still has. */
const NEXT_STEPS: { cat: NearbyCat; icon: string; label: string; note: string }[] = [
  { cat: "aff-tour", icon: "🎫", label: "找 Local tour", note: "一日遊與體驗行程" },
  { cat: "aff-hotel", icon: "🏨", label: "找住宿", note: "附近的飯店與民宿" },
  { cat: "rental", icon: "🚗", label: "找租車", note: "車站與市區的取車點" },
];

function NextUp({
  poiId,
  placeName,
  onExplore,
  onTranscript,
}: {
  poiId: string;
  placeName: string;
  onExplore: (poiId: string, cat?: NearbyCat) => void;
  onTranscript: () => void;
}) {
  const counts = useMemo(() => {
    const p = poi(poiId);
    if (!p) return null;
    return nearbyCounts({
      at: { lat: p.lat, lng: p.lng },
      destId: p.destId,
      destName: BY_DEST[p.destId]?.name ?? "",
      poiArea: p.area,
      radiusM: 5000,
    });
  }, [poiId]);

  const steps = NEXT_STEPS.filter((s) => (counts?.[s.cat] ?? 0) > 0);

  return (
    <div className="rm-in mt-3 flex-1 overflow-y-auto no-scrollbar">
      <div className="text-[16px] font-bold text-ink">接下來想做什麼？</div>
      {/* 5 km is a search radius, not a walk. Calling it 走路五公里 promised
          somebody they could reach a driver on foot. */}
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
        {placeName} 5 公里內的推薦
      </p>

      {steps.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-surface p-4 text-[13.5px] leading-relaxed text-ink-3">
          這個範圍內還沒有可以推薦的行程、住宿或租車。
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {steps.map((s) => (
            <button
              key={s.cat}
              onClick={() => onExplore(poiId, s.cat)}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left active:bg-surface-2"
            >
              <span className="text-[20px]" aria-hidden>
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{s.label}</span>
                <span className="block truncate text-[12px] text-ink-3">{s.note}</span>
              </span>
              <span className="num shrink-0 text-[12.5px] font-semibold text-ink-3">
                {counts?.[s.cat]} {getNearbyCountUnit(s.cat)} ›
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onExplore(poiId)}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand text-[13.5px] font-bold text-white active:bg-brand-press"
        >
          全部周邊推薦
        </button>
        <button
          onClick={onTranscript}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-surface text-[13.5px] font-bold text-ink active:bg-surface-2"
        >
          回到文字稿
        </button>
      </div>
      <div className="h-4" />
    </div>
  );
}

function ActionPill({
  icon,
  label,
  onClick,
  active,
  aria,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  aria: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      aria-pressed={active}
      className={`num inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full px-2 text-[12.5px] font-semibold transition ${
        active ? "bg-brand-wash text-brand" : "bg-surface text-ink-2 active:bg-surface-2"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** A bottom sheet that stays inside the player's own layer. */
function PlayerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10">
      <div className="rm-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="rm-up absolute inset-x-0 bottom-0 max-h-[80%] overflow-y-auto rounded-t-3xl bg-bg pb-6 no-scrollbar">
        <div className="sticky top-0 z-10 bg-bg pt-2.5">
          <div className="flex justify-center pb-1">
            <span className="h-1 w-9 rounded-full bg-line" />
          </div>
          <div className="px-5 pb-2 pt-1.5 text-[17px] font-bold text-ink">{title}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Comments, on this device.
 *
 * There is no backend and no moderation queue, so the note says so. Writing one
 * and having it disappear on reload would be worse than not offering the box —
 * lib/reactions.ts persists them, and 我的 can clear them with the demo reset.
 */
function CommentBox({
  audioId,
  comments,
  onClose,
}: {
  audioId: string;
  comments: { id: string; text: string; at: number }[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="px-5 pb-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="聽完想說什麼？"
        className="w-full resize-none rounded-2xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
      />
      <div className="mt-2 flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            onClose();
          }}
        >
          取消
        </Button>
        <Button
          disabled={!text.trim()}
          onClick={() => {
            addComment(audioId, text);
            setText("");
          }}
        >
          送出
        </Button>
      </div>

      {comments.length > 0 && (
        <div className="mt-4 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-2xl bg-surface p-3.5">
              <div className="text-[13.5px] leading-relaxed text-ink">{c.text}</div>
              <div className="num mt-1 text-[11.5px] text-ink-3">
                你 · {new Date(c.at).toLocaleDateString("zh-TW")}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
        留言只儲存在這台裝置上。
      </p>
    </div>
  );
}
