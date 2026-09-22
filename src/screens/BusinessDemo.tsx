import { useState } from "react";
import type { ReactNode } from "react";
import { DEAL_CATEGORY_LABELS } from "../types";
import { useNav } from "../nav";
import { Button, Empty, Note, Screen, Tag, TopBar } from "../components/ui";
import { dest } from "../data/destinations";
import { clearEvents, ctr, funnel } from "../lib/track";
import { PARTNERS, partner } from "../data/affiliatePartners";
import { imageProgress } from "../data/imagePrompts";

/**
 * The founder-facing screen. Reached from 我的 only — never from the tab bar,
 * because it answers a question the investor has and the traveller does not.
 *
 * It is told as an argument, not as a dashboard: first what the product earns
 * from and why the second path is the one worth building, then the simulated
 * funnel as evidence of the shape. The numbers come from taps made on this
 * device, so the screen says so before it shows any of them and repeats it at
 * the bottom.
 */

/** The two ways the product can earn. Copy, not measurement — always shown. */
const MODELS: {
  id: string;
  tag: string;
  title: string;
  chain: string[];
  /** The single line under the chain. */
  line: string;
  /** True on the path that carries the thesis. Marked in words, never colour. */
  thesis?: boolean;
}[] = [
  {
    id: "a",
    tag: "MODEL A",
    title: "流量變現",
    chain: ["首頁旅程服務", "門票 / 住宿 / 交通 / 租車", "OTA 平台", "Outbound", "分潤"],
    line: "不管誰打開 App，看到的都是同樣四個入口。",
  },
  {
    id: "b",
    tag: "MODEL B",
    title: "行程情境變現",
    chain: [
      "建立行程",
      "ResoMap 知道目的地與 POI",
      "在真正需要時提供門票 / 住宿 / 交通",
      "Outbound",
      "分潤",
    ],
    line: "行程資料的價值在這裡：知道誰、哪一天、會經過哪裡。",
    thesis: true,
  },
];

export function BusinessDemo() {
  const nav = useNav();
  /* localStorage sits outside React, so the funnel is read once on mount and
     re-read explicitly after a clear. A useMemo keyed on a counter would do the
     same work while pretending the counter was an input. */
  const [f, setF] = useState(funnel);
  const img = imageProgress();

  const hasData = f.impressions + f.clicks + f.outbound + f.bookings > 0;
  const share = (n: number) => (f.impressions ? Math.min(1, n / f.impressions) : 0);
  const nt = (n: number) => `NT$ ${n.toLocaleString()}`;

  /**
   * Four counts drawn as a share of impressions, plus money.
   *
   * The commission row gets no bar. It used to borrow the bookings width on the
   * argument that it is the same funnel step measured in TWD — but a reader does
   * not see "the step where this happened", they see a bar as long as the one
   * above it and read it as a quantity. Commission has no denominator here:
   * there is no impression count for money, so any width drawn against it is a
   * number nobody measured. On the one screen in the app whose whole job is to
   * be believed about its own figures, a decorative bar is the exact thing not
   * to draw.
   */
  const rows: { label: string; value: string; width: number | null }[] = [
    { label: "曝光", value: f.impressions.toLocaleString(), width: share(f.impressions) },
    { label: "點擊", value: f.clicks.toLocaleString(), width: share(f.clicks) },
    { label: "前往平台", value: f.outbound.toLocaleString(), width: share(f.outbound) },
    { label: "模擬預訂", value: f.bookings.toLocaleString(), width: share(f.bookings) },
    { label: "模擬佣金", value: nt(f.commissionTwd), width: null },
  ];

  /* byPartner only gains a row when an event names the platform, but filtering
     keeps a future all-zero tally out of a table that is meant to be evidence. */
  const partners = f.byPartner.filter((p) => p.clicks + p.outbound + p.bookings > 0);

  return (
    <Screen>
      <TopBar title="商業模式" onBack={nav.back} />

      {/* Before any number, not after it. */}
      <div className="mx-5 mt-1 rounded-2xl bg-brand-wash px-4 py-3 text-[12.5px] leading-relaxed text-ink">
        <span className="font-bold">Demo Data</span>{" "}
        — 以下數字來自這台裝置的模擬點擊，不是真實營收。
      </div>

      <header className="px-5 pt-6">
        <h2 className="text-[22px] font-bold leading-tight text-ink">
          ResoMap Revenue Model
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          在正確的旅行節點，連結使用者需求與旅遊服務。
        </p>
      </header>

      {/* Shown with or without events: this is the model, not a measurement. */}
      <section className="mt-8">
        <h2 className="mb-3 px-5 text-[17px] font-bold text-ink">兩條變現路徑</h2>
        <div className="space-y-3 px-5">
          {MODELS.map((m) => (
            <div key={m.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold tracking-wide text-ink-3">
                  {m.tag}
                </span>
                <span className="text-[11px] text-ink-3">·</span>
                <span className="text-[15px] font-bold text-ink">{m.title}</span>
              </div>
              {/* Joined rather than mapped: the chain has to wrap mid-sequence on
                  a 393px screen, and separate nodes fight the line breaks. */}
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
                {m.chain.join(" › ")}
              </p>
              <p
                className={`mt-2.5 text-[13px] leading-relaxed ${
                  m.thesis ? "text-ink" : "text-ink-2"
                }`}
              >
                {m.line}
              </p>
            </div>
          ))}
        </div>
      </section>

      {hasData ? (
        <>
          <Panel title="模擬漏斗">
            <div className="space-y-5 px-5">
              {rows.map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14.5px] text-ink-2">{r.label}</span>
                    <span className="num text-[19px] font-bold text-ink">{r.value}</span>
                  </div>
                  {r.width !== null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${r.width * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="num px-5 pt-5 text-[13.5px] text-ink-2">
              點擊率 {(ctr(f) * 100).toFixed(1)}%
            </p>
          </Panel>

          {partners.length > 0 && (
            <Panel title="各平台表現">
              <div className="px-5">
                {/* The numeric columns are w-12 rather than w-11 because
                    「模擬預訂」is four CJK glyphs — 44px at 11px, which wraps to
                    two lines inside a 44px box and drops the header off the
                    baseline it shares with the figures below it. */}
                <div className="flex items-baseline gap-2 pb-2 text-[11px] text-ink-3">
                  <span className="min-w-0 flex-1">平台</span>
                  <span className="w-12 shrink-0 whitespace-nowrap text-right">點擊</span>
                  <span className="w-12 shrink-0 whitespace-nowrap text-right">前往</span>
                  <span className="w-12 shrink-0 whitespace-nowrap text-right">
                    模擬預訂
                  </span>
                  <span className="w-20 shrink-0 whitespace-nowrap text-right">
                    模擬佣金
                  </span>
                </div>
                {partners.map((p) => (
                  <div key={p.partner} className="flex items-baseline gap-2 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                      {partner(p.partner).name}
                    </span>
                    <Figure>{p.clicks}</Figure>
                    <Figure>{p.outbound}</Figure>
                    <Figure>{p.bookings}</Figure>
                    <span className="num w-20 shrink-0 text-right text-[12.5px] font-semibold text-ink-2">
                      {nt(p.commissionTwd)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Which trips produced the clicks. This is the evidence for MODEL B:
              if the revenue tracks the destinations people are planning, the
              itinerary data is what is earning, not the shop window. */}
          {f.byDest.length > 0 && (
            <Panel title="點擊來自哪些目的地">
              <div className="px-5">
                {f.byDest.slice(0, 5).map((d) => (
                  <div key={d.destId} className="flex items-baseline gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                      {dest(d.destId)?.name ?? d.destId}
                    </span>
                    <span className="num shrink-0 text-[13px] font-semibold text-ink-2">
                      {d.clicks} 次
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {f.byCategory.length > 0 && (
            <Panel title="點擊來自哪些類別">
              <div className="px-5">
                {f.byCategory.map((c) => (
                  <div key={c.category} className="flex items-baseline gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                      {DEAL_CATEGORY_LABELS[c.category]}
                    </span>
                    <span className="num shrink-0 text-[13px] font-semibold text-ink-2">
                      {c.clicks} 次
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      ) : (
        <Empty icon="📊" text="還沒有模擬數據。在優惠頁點幾張卡片再回來。" />
      )}

      {/* Kept out of the empty branch: it is counted from the image manifest in
          the repo, so it is readable whether or not anybody tapped a deal. */}
      <Panel title="內容準備進度">
        {/* 照片 now, not 圖片. The word was deliberately vague while the
            manifest also held four AI historical scenes — calling those
            "照片" would have been the exact claim data/imagePrompts.ts exists
            to avoid. Those slots are gone and every remaining one is a real
            photograph with a credit, so the vaguer word would now be
            under-claiming instead. */}
        <p className="num px-5 text-[14.5px] text-ink">
          {img.done} / {img.total} 張景點照片已完成
        </p>
      </Panel>

      {/* Offering to clear an empty store is a button that cannot do anything. */}
      {hasData && (
        <div className="px-5 pt-8">
          <Button
            variant="ghost"
            onClick={() => {
              clearEvents();
              setF(funnel());
            }}
          >
            清除模擬數據
          </Button>
        </div>
      )}

      {/* Rates mirror RATE in lib/track.ts; the platform list is read from the
          partner data so it can never drift from what the app links out to. */}
      <Note>
        模擬佣金以各平台公開的參考分潤區間估算（門票 5%、住宿 4%、交通 4%、eSIM
        8%、旅平險 10%、在地優惠 6%），只用來說明商業模式的量級，不是任何一方談定的條件。
        ResoMap 參加 Klook、KKday 聯盟行銷計畫，與{" "}
        {PARTNERS.filter((p) => p.id !== "klook" && p.id !== "kkday").map((p) => p.name).join("、")}{" "}
        皆無合作關係。
      </Note>

      <div className="h-24 shrink-0" />
    </Screen>
  );
}

/**
 * A section head carrying the Demo 資料 mark.
 *
 * The banner at the top scrolls away long before the reader reaches 各平台表現,
 * so the label repeats per numeric section rather than once per screen.
 */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline gap-2 px-5">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <Tag kind="demo" />
      </div>
      {children}
    </section>
  );
}

/* w-12 to match the header above it — figures and labels have to share a right
   edge, or the table reads as four unrelated columns. */
function Figure({ children }: { children: ReactNode }) {
  return (
    <span className="num w-12 shrink-0 text-right text-[13.5px] font-semibold text-ink-2">
      {children}
    </span>
  );
}
