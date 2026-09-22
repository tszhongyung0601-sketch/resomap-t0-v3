import type { AffiliatePartner, PartnerId } from "../types";

/**
 * Platforms the demo links out to.
 *
 * V3: ResoMap is in the Klook and KKday affiliate programmes (the ids live in
 * data/affiliateLinks.ts) and has no agreement with the other three. An
 * affiliate programme is not a partnership either. Nothing in this app may
 * describe any of them as a partner, an official collaboration or a strategic
 * relationship —
 * the wording everywhere is "查看 Klook 優惠" or "前往 Booking", which is what
 * an ordinary affiliate link is. The distinction matters: a prototype that
 * invents a commercial relationship is the one slide that can get a founder
 * into real trouble.
 */
export const PARTNERS: AffiliatePartner[] = [
  {
    id: "klook",
    name: "Klook",
    kinds: ["ticket", "transport", "esim"],
    site: "klook.com",
    tint: "#FFE7DA",
  },
  {
    id: "kkday",
    name: "KKday",
    kinds: ["ticket", "transport", "esim"],
    site: "kkday.com",
    tint: "#E0EEFB",
  },
  {
    id: "booking",
    name: "Booking.com",
    kinds: ["stay"],
    site: "booking.com",
    tint: "#DFE8FA",
  },
  {
    id: "agoda",
    name: "Agoda",
    kinds: ["stay"],
    site: "agoda.com",
    tint: "#EDE4FA",
  },
  {
    id: "tripcom",
    name: "Trip.com",
    kinds: ["stay", "transport"],
    site: "trip.com",
    tint: "#DCEBFF",
  },
];

export const BY_PARTNER: Record<PartnerId, AffiliatePartner> = Object.fromEntries(
  PARTNERS.map((p) => [p.id, p]),
) as Record<PartnerId, AffiliatePartner>;

export const partner = (id: PartnerId) => BY_PARTNER[id];

/** The one sentence every commercial surface in the demo has to carry. */
export const AFFILIATE_DISCLOSURE =
  "價格與優惠為 Demo 示意資料，非即時報價。ResoMap 參加 Klook、KKday 聯盟行銷計畫，與其他平台無合作關係。";
