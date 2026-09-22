import { useState, type ReactNode } from "react";
import { photoFor } from "../data/imagePrompts";
import { eventPhotoFor, portraitFor, shotFor, type HasPhoto, vehicleFor } from "../lib/photo";
import { portraitCredit } from "../data/portraitCredits";
import { Avatar, Thumb } from "./ui";
import type { Poi, PoiKind } from "../types";
import type { StopView } from "../lib/stop";
import { vehicleCredit } from "../data/vehicleCredits";
import { eventCredit } from "../data/eventCredits";

/**
 * A place's picture, until there is a photograph of it.
 *
 * The app ships no photography, and the honest response to that is not a stock
 * image of the wrong temple — it is not pretending to have a photo at all.
 *
 * The first version of this drew soft radial gradients, which was the wrong
 * instinct: at card size a blurry blob does not read as "an illustration", it
 * reads as "a photograph that failed to load properly", and the whole product
 * looks unfinished. Everything here is now hard-edged — flat bands, a crisp
 * horizon, a solid sun, angular silhouettes. Nothing is soft, so nothing can be
 * mistaken for out of focus. It looks like a screen-printed travel poster,
 * which is a thing somebody chose.
 *
 * When a real photograph arrives in the manifest, `PoiImage` uses it instead.
 */

type Scene = {
  sky: [string, string];
  land: string;
  ridge: string;
  /** Percentage from the top. */
  horizon: number;
  sun: string | null;
};

const SCENES: Record<PoiKind, Scene> = {
  nature:     { sky: ["#A8CFE4", "#D6E9F0"], land: "#4E7C62", ridge: "#3C6650", horizon: 62, sun: "#FFF0CE" },
  attraction: { sky: ["#F4DFBE", "#F8EBD6"], land: "#B07C4E", ridge: "#8E5F38", horizon: 66, sun: "#FFE9B8" },
  food:       { sky: ["#F6D6C4", "#FAE6DA"], land: "#B25E3E", ridge: "#8E432A", horizon: 70, sun: null },
  shopping:   { sky: ["#DED0EA", "#EDE5F3"], land: "#7C6796", ridge: "#5F4A78", horizon: 64, sun: "#F6DCEA" },
  activity:   { sky: ["#BFDCE8", "#DCEDF3"], land: "#4E7F96", ridge: "#3A6377", horizon: 68, sun: null },
  stay:       { sky: ["#DCDEE6", "#EAEBF0"], land: "#6E7285", ridge: "#545869", horizon: 64, sun: null },
  transit:    { sky: ["#DCE2E8", "#EBEFF3"], land: "#6B7480", ridge: "#515963", horizon: 72, sun: null },
};

/** Stable per-id jitter, so two temples in one city do not look identical. */
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function Generated({
  poi,
  radius,
  emoji,
}: {
  poi: Poi;
  radius: number;
  emoji: boolean;
}) {
  const s = SCENES[poi.kind] ?? SCENES.attraction;
  const n = seed(poi.id);
  const horizon = s.horizon + ((n % 11) - 5);
  const sunX = 20 + (n % 60);
  /* Two ridges, offset, drawn as clipped polygons rather than blurred blobs. */
  const peakA = 24 + (n % 22);
  const peakB = 58 + ((n >> 3) % 24);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: radius,
        /* Hard stop at the horizon: two flat fields, no gradient across the
           join. This single edge is what stops it reading as a photo. */
        background: `linear-gradient(180deg, ${s.sky[0]} 0%, ${s.sky[1]} ${horizon}%, ${s.land} ${horizon}%, ${s.land} 100%)`,
      }}
    >
      {s.sun && (
        <span
          className="absolute rounded-full"
          style={{
            width: "18%",
            aspectRatio: "1",
            left: `${sunX}%`,
            top: `${Math.max(6, horizon - 34)}%`,
            background: s.sun,
          }}
        />
      )}

      {/* Ridge line — a solid polygon sitting on the horizon. */}
      <svg
        className="absolute inset-x-0"
        style={{ top: `${horizon - 16}%`, height: "26%" }}
        viewBox="0 0 100 26"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon
          points={`0,26 ${peakA},4 ${(peakA + peakB) / 2},15 ${peakB},7 100,26`}
          fill={s.ridge}
        />
      </svg>

      {emoji && (
        <span
          className="absolute inset-0 grid place-items-center"
          style={{ fontSize: "34%" }}
        >
          {poi.emoji}
        </span>
      )}
    </div>
  );
}

export function Cover({
  poi,
  height = 120,
  radius = 14,
  emoji = true,
  className = "",
}: {
  poi: Poi;
  height?: number | string;
  radius?: number;
  emoji?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ height, borderRadius: radius }}
      aria-hidden
    >
      <Generated poi={poi} radius={radius} emoji={emoji} />
    </div>
  );
}

/**
 * The real photograph when the manifest has one, the generated cover when it
 * does not.
 *
 * `srcSet` is written for 1x/2x because the demo is shown on Retina laptops and
 * phones, where a 400px-wide source in a 400px slot is visibly soft. The
 * generated cover stays behind the photo rather than being replaced by it, so a
 * failed request degrades to the graphic instead of a broken-image icon — and
 * the name is always in the DOM for anybody who cannot see either.
 */
export function PoiImage({
  poi,
  height = 120,
  radius = 14,
  emoji = true,
  large = false,
  className = "",
}: {
  poi: Poi;
  height?: number | string;
  radius?: number;
  emoji?: boolean;
  /** Ask for the 1600px file. Only for slots that fill the screen width. */
  large?: boolean;
  className?: string;
}) {
  const shot = photoFor(poi);
  const [failed, setFailed] = useState(false);
  /* One base per size rather than a 1x/2x srcSet off a single file: the two files
     are cropped differently (4:3 for cards, 16:9 for heroes), so they are not the
     same image at two scales and pretending otherwise would letterbox one of them. */
  const src = large ? (shot?.srcLarge ?? shot?.src) : shot?.src;
  const showPhoto = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ height, borderRadius: radius }}
    >
      <Generated poi={poi} radius={radius} emoji={emoji && !showPhoto} />

      {showPhoto && src && (
        <img
          src={`${import.meta.env.BASE_URL}${src}`}
          alt={poi.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
          style={{ borderRadius: radius }}
        />
      )}
    </div>
  );
}

/**
 * A place's square thumbnail — the photograph, at list size.
 *
 * V3 replaced the emoji tile everywhere a *place* is shown small: the trip list,
 * search, saved, the map card. A row of 🏯 🏮 🍡 told somebody the category of
 * each stop; a photograph tells them which stop it is, which is the question a
 * list of their own itinerary is there to answer.
 *
 * The fallback is the old tile, not the generated poster. At 44px the poster's
 * horizon and ridges turn to mush, while an emoji on a tint is still legible —
 * and it is what the app showed before, so a missing photo looks deliberate
 * rather than broken. A request that fails drops to the same tile.
 *
 * Only places. A driver, a hire counter or a coupon keeps its emoji tile via
 * `Thumb` or `StopThumb`: there is no photograph of 「iRent 花蓮車站」 and a stock
 * car park would be a picture of the wrong thing.
 */
export function PoiThumb({
  poi,
  size = 56,
  radius = 14,
}: {
  poi: Poi;
  size?: number;
  radius?: number;
}) {
  const shot = photoFor(poi);
  const [failed, setFailed] = useState(false);
  if (!shot?.src || failed) {
    return <Thumb emoji={poi.emoji} tint={poi.tint} size={size} radius={radius} />;
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}${shot.src}`}
      alt={poi.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 bg-surface-2 object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

/** The same thumbnail for an itinerary stop: a photo for a place, a tile for anything else. */
export function StopThumb({
  view,
  size = 44,
  radius = 12,
}: {
  view: StopView;
  size?: number;
  radius?: number;
}) {
  return view.poi ? (
    <PoiThumb poi={view.poi} size={size} radius={radius} />
  ) : (
    <Thumb emoji={view.emoji} tint={view.tint} size={size} radius={radius} />
  );
}

/**
 * Photographer and licence, under the image.
 *
 * Every CC licence except CC0 requires attribution, so this is a licence term
 * rather than a caption — a photo shipped without it is a breach. CC0 waives the
 * requirement, but the line still names the photographer: they gave the work
 * away and saying who they were costs nothing.
 */
export function PhotoCredit({ poi }: { poi: Poi }) {
  const shot = photoFor(poi);
  const c = shot?.credit;
  if (!c) return null;
  return (
    <p className="px-5 pt-1.5 text-[11px] leading-relaxed text-ink-3">
      照片：
      <a href={c.source} target="_blank" rel="noopener noreferrer" className="underline">
        {c.author}
      </a>
      {" / "}
      <a href={c.licenceUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {c.licence}
      </a>
      {/* Named rather than assumed. Everything here came from Wikimedia until
          the overseas gaps were filled from a stock library, and printing the
          wrong provenance under a photograph is worse than printing none. */}
      {` · via ${c.via ?? "Wikimedia Commons"}`}
    </p>
  );
}

/**
 * The same generated poster, for something that is not a POI.
 *
 * Merchants, hotels and tours need a picture and there is no photograph of any
 * of them — they are demo records. Rather than ship a stock image of somebody
 * else's shop, or leave a grey rectangle, they get exactly the graphic every
 * place in this app already uses, keyed by their own id so two souvenir shops
 * in one district do not come out identical.
 *
 * `kind` picks the palette. It is a `PoiKind` because the palettes are already
 * written against it and inventing a second, parallel set of scene colours for
 * merchants would mean the same street could be two different colours on two
 * screens.
 */
export function SceneCover({
  id,
  kind,
  emoji,
  height = 120,
  radius = 14,
  showEmoji = true,
  className = "",
}: {
  id: string;
  kind: PoiKind;
  emoji: string;
  height?: number | string;
  radius?: number;
  showEmoji?: boolean;
  className?: string;
}) {
  /* Generated only reads id, kind and emoji off the record, so a stand-in with
     those three fields is the whole contract — and keeping it local means the
     component keeps taking a real Poi everywhere else. */
  const stand = { id, kind, emoji } as Poi;
  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ height, borderRadius: radius }}
      aria-hidden
    >
      <Generated poi={stand} radius={radius} emoji={showEmoji} />
    </div>
  );
}

/**
 * The picture for a merchant, a provider, an affiliate listing or a category
 * card — a real photograph when the record has one, the generated poster when
 * it has not.
 *
 * Same contract as `PoiImage`: the poster is drawn underneath and the photo on
 * top, so a failed request degrades to the graphic rather than to a broken-image
 * glyph. `loading="lazy"` is not optional here — a 周邊推薦 list can hold a
 * dozen of these and none of them is above the fold.
 *
 * `size` picks which file: cards ask for the 720px crop, headers for the 1280px
 * one. Asking for the hero in a 353px slot is most of the payload for none of
 * the sharpness, which is the same reason PoiImage keeps two bases.
 */
export function RecordPhoto({
  record,
  fallbackId,
  fallbackKind,
  emoji,
  height = 160,
  radius = 16,
  size = "card",
  className = "",
  children,
}: {
  record: HasPhoto;
  /** Seeds the poster's jitter, so two shops do not draw the same graphic. */
  fallbackId: string;
  fallbackKind: PoiKind;
  emoji: string;
  height?: number | string;
  radius?: number;
  size?: "card" | "hero";
  className?: string;
  /** Overlaid on the image — a badge, a label. */
  children?: ReactNode;
}) {
  const shot = shotFor(record);
  const [failed, setFailed] = useState(false);
  const src = shot ? (size === "hero" ? shot.hero : shot.card) : undefined;
  const show = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ height, borderRadius: radius }}
    >
      <Generated
        poi={{ id: fallbackId, kind: fallbackKind, emoji } as Poi}
        radius={radius}
        emoji={!show}
      />
      {show && src && (
        <img
          src={src}
          alt=""
          /* A hero is above the fold by definition — it is the first thing on
             the screen it heads. Deferring it means the page opens on a poster
             and swaps to the photograph while somebody is already reading. */
          loading={size === "hero" ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
          style={{ borderRadius: radius }}
        />
      )}
      {/* A category card can be illustrated by a person — 私人導遊 is a face, not
          a street — and a face is marked wherever it appears, not only on that
          person's own card. */}
      {show && shot?.person && <AiMark />}
      {children}
    </div>
  );
}

/**
 * Who took the portrait.
 *
 * The Pexels licence does not require this. It is here because forty
 * photographers' work fronts this product, and naming them costs one line — the
 * same argument the CC credit makes next door, minus the legal obligation.
 */
export function PortraitCredit({ providerId }: { providerId: string }) {
  const c = portraitCredit(providerId);
  if (!c) return null;
  return (
    <p className="px-5 pt-1.5 text-[11px] leading-relaxed text-ink-3">
      人物照片為圖庫示意圖，非實際服務者本人。攝影：
      <a href={c.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {c.photographer}
      </a>
      {" · via "}
      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
        Pexels
      </a>
    </p>
  );
}

/**
 * Photographer and licence for a borrowed T0 photograph.
 *
 * Only a real photograph carries a credit, and when it does the licence
 * requires it to be shown — so this renders nothing for an illustrative demo
 * image and everything for a CC one. The 示意圖 line for the demo images sits
 * at block level with the rest of the disclosures, not on every card.
 */
export function RecordPhotoCredit({ record }: { record: HasPhoto }) {
  const c = shotFor(record)?.credit;
  if (!c) return null;
  return (
    <p className="px-5 pt-1.5 text-[11px] leading-relaxed text-ink-3">
      周邊實景照片：
      <a href={c.source} target="_blank" rel="noopener noreferrer" className="underline">
        {c.author}
      </a>
      {" / "}
      <a href={c.licenceUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {c.licence}
      </a>
      {` · via ${c.via ?? "Wikimedia Commons"}`}
    </p>
  );
}

/**
 * The badge that says a face was not photographed.
 *
 * On the image, not at the bottom of the page. Every other illustrative asset
 * in this demo is a shop front or a street, and a line of small print under the
 * list is proportionate to those. A portrait is different: a photograph of a
 * person is the one thing a viewer will assume is a real person unless it is
 * marked where they are looking, and the person in it does not exist. Small,
 * on the corner the distance chip does not use, and never on top of the face.
 */
function AiMark({ tiny = false }: { tiny?: boolean }) {
  /* 「圖庫示意」 and not 「AI 生成」. These are photographs of real people —
     stock models who signed a release — so the earlier wording became false the
     day the drawings were replaced. What still needs saying is the same thing it
     always was: this is not the person whose name is under it.

     At 96px there is no room for four characters without covering the face, and
     a mark that covers the face is worse than no mark. 「示意」 carries it in the
     corner and the line at the foot of the list carries the rest. */
  if (tiny) {
    return (
      <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 py-px text-[9px] font-bold leading-tight text-white/95">
        示意
      </span>
    );
  }
  return (
    <span className="absolute right-2 top-2 whitespace-nowrap rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white/95">
      圖庫示意
    </span>
  );
}

/**
 * A driver or a guide, drawn as the person they are.
 *
 * Two states and no third. A portrait if one has been produced, and otherwise a
 * monogram on the colour this person already wears everywhere else in the app —
 * which reads as "a profile without a photo yet", the way every product with
 * people in it draws that. What it will never do is borrow a photograph of the
 * nearest attraction: a guide at 七星潭 represented by an empty pebble beach is
 * a card with no person on it, and a traveller choosing between two guides is
 * then choosing between two identical beaches.
 *
 * `eager` for the first card in a list, lazy for the rest — a 周邊推薦 list can
 * hold a dozen of these and eleven of them are below the fold.
 */
export function PersonPhoto({
  id,
  name,
  color,
  initial,
  height = 150,
  radius = 0,
  size = "card",
  eager = false,
  className = "",
  children,
}: {
  id: string;
  name: string;
  color: string;
  initial: string;
  height?: number | string;
  radius?: number;
  size?: "card" | "hero" | "thumb";
  eager?: boolean;
  className?: string;
  /** Overlaid on the image — the distance chip, a kind label. */
  children?: ReactNode;
}) {
  const shot = portraitFor(id);
  const [failed, setFailed] = useState(false);
  /* `thumb` is a separately composed square, not a crop of the wide one: half
     of a 16:9 portrait is a person shoved against the edge of the frame. */
  const src = shot
    ? size === "hero"
      ? shot.hero
      : size === "thumb"
        ? (shot.thumb ?? shot.card)
        : shot.card
    : undefined;
  const show = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-surface-2 ${className}`}
      style={{ height, borderRadius: radius }}
    >
      {/* Underneath the photograph rather than instead of it, so a request that
          fails degrades to the monogram and not to a broken-image glyph. */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ background: `linear-gradient(160deg, ${color}1f, ${color}0a 62%, transparent)` }}
      >
        <Avatar
          name={name}
          color={color}
          initial={initial}
          size={size === "hero" ? 76 : size === "thumb" ? 44 : 58}
        />
      </div>

      {show && src && (
        <img
          src={src}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {show && <AiMark tiny={size === "thumb"} />}
      {children}
    </div>
  );
}

/**
 * A stop's picture, whatever the stop turns out to be.
 *
 * A place gets its photograph, or the drawn landscape that stands in for one.
 * A hire car counter gets neither, and should not: there is no photograph of
 * 「iRent 花蓮車站」 in this project, and inventing a generic car park for it
 * would be the same mistake as putting a stock beach behind a named restaurant.
 * It gets a flat tile with the one glyph that says what it is — the same
 * treatment `Thumb` gives a service everywhere else in the app.
 */
export function StopImage({
  view,
  height = 48,
  radius = 12,
  className = "",
}: {
  view: StopView;
  height?: number;
  radius?: number;
  className?: string;
}) {
  if (view.poi) {
    return (
      <PoiImage
        poi={view.poi}
        height={height}
        radius={radius}
        className={className}
      />
    );
  }
  return (
    <div
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        height,
        borderRadius: radius,
        background: view.tint,
        fontSize: height * 0.42,
      }}
    >
      {view.emoji}
    </div>
  );
}

/**
 * The car a hire counter is offering.
 *
 * Two states and no third, the same shape `PersonPhoto` has: a photograph when
 * one has been fetched, and otherwise the flat tile with the one glyph that
 * says what this is. Never a broken image — a request that fails falls back to
 * the tile underneath it rather than to the browser's torn-page icon.
 *
 * The mark is not optional and not conditional on anything but the photograph
 * being shown. This is a picture of *a* car, on a card naming a specific
 * counter, and a reader who is not told will reasonably assume it is a picture
 * of *the* car waiting for them.
 */
export function VehiclePhoto({
  id,
  model,
  height = 150,
  radius = 0,
  size = "card",
  eager = false,
  className = "",
  children,
}: {
  id: string;
  /** The class of car, for the alt text. The one true thing about the image. */
  model?: string;
  height?: number | string;
  radius?: number;
  size?: "card" | "hero" | "thumb";
  eager?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const shot = vehicleFor(id);
  const [failed, setFailed] = useState(false);
  /* `thumb` is a separately composed square rather than a crop of the wide one:
     half of a 16:9 car is a door. */
  const src = shot
    ? size === "hero"
      ? shot.hero
      : size === "thumb"
        ? (shot.thumb ?? shot.card)
        : shot.card
    : undefined;
  const show = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ height, borderRadius: radius, background: "#eef2f6" }}
    >
      {/* Underneath the photograph rather than instead of it, so a failed
          request degrades to the tile the cards used before there were any
          photographs at all. */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ fontSize: typeof height === "number" ? height * 0.36 : 28 }}
      >
        🚗
      </div>

      {show && src && (
        <img
          src={src}
          /* The class of car, which is what the picture is genuinely of.
             Not the brand and not the counter — neither of those is in the
             frame, and an alt attribute is a description, not a caption. */
          alt={model ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {show && <AiMark tiny={size === "thumb"} />}
      {children}
    </div>
  );
}

/**
 * Photographer, and what the photograph is and is not.
 *
 * The Pexels licence asks for nothing. This is here for the same reason the
 * portrait credit is — twenty-two photographers whose work fronts a product
 * ought to be named somewhere in it — and it carries the disclaimer in the same
 * breath, because the two facts belong together: this is a real photograph, and
 * it is not a photograph of this counter's car.
 */
export function VehicleCredit({ rentalId }: { rentalId: string }) {
  const c = vehicleCredit(rentalId);
  if (!c) return null;
  return (
    <p className="px-5 pt-1.5 text-[11px] leading-relaxed text-ink-3">
      車輛照片為 {c.model} 的圖庫示意圖，非該據點實際車輛。攝影：
      <a href={c.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {c.photographer}
      </a>
      {" · via "}
      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
        Pexels
      </a>
    </p>
  );
}

/* --------------------------------------------------------------- events */

/**
 * The picture on an event card.
 *
 * Marked 圖庫示意 like the hire cars, and for a stronger reason. A stock
 * forecourt over a real counter is at worst the wrong forecourt; a real
 * photograph of a real lantern festival over an event that is not happening
 * is evidence for something untrue. The rail and the detail page both say in
 * a sentence that the events are invented — the mark on the image is what
 * survives the screenshot that loses the sentence.
 *
 * The emoji tile stays underneath rather than instead of it, so a failed
 * request degrades to what the card looked like before there were pictures.
 */
export function EventImage({
  id,
  emoji,
  tint,
  alt,
  height = 96,
  radius = 12,
  size = "card",
  className = "",
}: {
  id: string;
  emoji: string;
  tint: string;
  /** What the photograph shows — the photographer's words, not the event's. */
  alt?: string;
  height?: number | string;
  radius?: number;
  size?: "card" | "hero";
  className?: string;
}) {
  const shot = eventPhotoFor(id);
  const [failed, setFailed] = useState(false);
  const src = shot ? (size === "hero" ? shot.hero : shot.card) : undefined;
  const show = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ height, borderRadius: radius, background: tint }}
    >
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ fontSize: typeof height === "number" ? height * 0.34 : 26 }}
        aria-hidden
      >
        {emoji}
      </div>

      {show && src && (
        <img
          src={src}
          /* The photographer's description, not the event's name. An alt
             attribute describes the image, and the image is not of the
             event — writing the event's name here would put the fiction
             into the one place a screen reader treats as documentation. */
          alt={alt ?? ""}
          /* A hero is the first thing on its screen, so waiting for the lazy
             heuristic to notice it is a beat of empty tile on every open. Rail
             cards stay lazy — most of them are off-screen. */
          loading={size === "hero" ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* The corner mark, small on a rail card where four characters would
          cover a third of the picture. A string height means somebody sized it
          in CSS units, and the small mark is the safe read at any of them. */}
      {show && <AiMark tiny={size === "card" && (typeof height !== "number" || height <= 110)} />}
    </div>
  );
}

/** Photographer, and what the photograph is and is not. */
export function EventCredit({ eventId }: { eventId: string }) {
  const c = eventCredit(eventId);
  if (!c) return null;
  return (
    <p className="px-5 pt-1.5 text-[11px] leading-relaxed text-ink-3">
      這張是圖庫示意圖，不是這場活動的照片——這場活動是虛構的。照片內容：{c.alt}。攝影：
      <a href={c.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {c.photographer}
      </a>
      {" · via "}
      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
        Pexels
      </a>
    </p>
  );
}
