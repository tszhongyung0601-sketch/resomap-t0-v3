import { useSyncExternalStore } from "react";

/**
 * What the traveller has done to a guide: liked it, marked it as not for them,
 * or said something about it.
 *
 * Same shape as lib/saved.ts — module state, `useSyncExternalStore`, written
 * through to localStorage — and for the same reason: the heart on a list row,
 * the heart in the player and the count under the title are three components
 * that must never disagree, and a reaction that forgets on reload is a toggle
 * that lies about what it does.
 *
 * Like and dislike are mutually exclusive, because they are one opinion with
 * two directions. Tapping the one you already chose clears it.
 *
 * There is no backend. Comments live on this device and say so on screen.
 */

const KEY = "resomap_v3_reactions";

export interface Comment {
  id: string;
  audioId: string;
  text: string;
  /** Epoch ms, so the list can sort without parsing. */
  at: number;
}

interface Reactions {
  liked: string[];
  disliked: string[];
  comments: Comment[];
}

const EMPTY: Reactions = { liked: [], disliked: [], comments: [] };

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function read(): Reactions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Reactions>;
    return {
      liked: strings(parsed.liked),
      disliked: strings(parsed.disliked),
      comments: Array.isArray(parsed.comments)
        ? parsed.comments.filter(
            (c): c is Comment =>
              Boolean(c) &&
              typeof c.id === "string" &&
              typeof c.audioId === "string" &&
              typeof c.text === "string" &&
              typeof c.at === "number",
          )
        : [],
    };
  } catch {
    /* Corrupt or unavailable storage. An empty set is a survivable answer;
       throwing here would take the player down over a heart. */
    return EMPTY;
  }
}

let state: Reactions = read();
const watchers = new Set<() => void>();

function commit(next: Reactions) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Quota or private mode. The session still works; only the remembering is
       lost, and that is better than losing the tap. */
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

export function useReactions(): Reactions {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const without = (list: string[], id: string) => list.filter((x) => x !== id);

/** Like. Clears a dislike on the same guide — it is one opinion, not two. */
export function toggleLike(audioId: string) {
  const on = state.liked.includes(audioId);
  commit({
    ...state,
    liked: on ? without(state.liked, audioId) : [...state.liked, audioId],
    disliked: without(state.disliked, audioId),
  });
}

export function toggleDislike(audioId: string) {
  const on = state.disliked.includes(audioId);
  commit({
    ...state,
    disliked: on ? without(state.disliked, audioId) : [...state.disliked, audioId],
    liked: without(state.liked, audioId),
  });
}

export const isLiked = (audioId: string) => state.liked.includes(audioId);
export const isDisliked = (audioId: string) => state.disliked.includes(audioId);

/**
 * The number under a guide, which is the authored figure plus this device's own
 * tap. Derived rather than stored, so the demo count and the traveller's own
 * action can never fall out of step.
 */
export const likeCount = (authored: number, liked: boolean) =>
  authored + (liked ? 1 : 0);

export function addComment(audioId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  commit({
    ...state,
    comments: [
      ...state.comments,
      { id: `c-${audioId}-${Date.now()}`, audioId, text: body, at: Date.now() },
    ],
  });
}

export function removeComment(id: string) {
  commit({ ...state, comments: state.comments.filter((c) => c.id !== id) });
}

/** Newest first. */
export const commentsFor = (list: Comment[], audioId: string) =>
  list.filter((c) => c.audioId === audioId).sort((a, b) => b.at - a.at);

/** The demo reset clears these too — see App.tsx's reset(). */
export const resetReactions = () => commit(EMPTY);
