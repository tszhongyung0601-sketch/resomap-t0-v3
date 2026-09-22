import { POIS, poi } from "../data";
import { story } from "../data/stories";
import { PoiImage, PoiThumb } from "../components/Cover";
import { Empty, Headphones, Screen, StoryBadge, TopBar } from "../components/ui";
import { playLabel, rating } from "../lib/story";
import { useSaved } from "../lib/saved";
import { useNav } from "../nav";
import { POI_KIND_LABELS, type Poi, type Story } from "../types";

/**
 * 收藏 — two shelves, not one.
 *
 * A place and a guide are different things to come back to: one is somewhere you
 * might go, the other is something you might listen to. Merged into a single
 * list they compete, and neither is scannable. Split, each section answers its
 * own question and the counts mean something.
 *
 * Both counts are `length` on the filtered arrays. There is no stored total to
 * drift away from the list under it.
 */
export function Saved() {
  const nav = useNav();
  const { pois, stories } = useSaved();

  /* Read through the data rather than trusting the stored ids: a saved id that
     no longer resolves would throw inside poi() in DEV, and a shelf is not worth
     taking the screen down for. */
  const places = pois.map((id) => POIS.find((p) => p.id === id)).filter(Boolean) as Poi[];
  const guides = stories.map((id) => story(id)).filter(Boolean) as Story[];

  const nothing = places.length === 0 && guides.length === 0;

  return (
    <Screen>
      <TopBar title="收藏" onBack={nav.back} />

      {nothing ? (
        /* No pitch. It says what the empty space means and stops — 「快去收藏
           吧」 would be the app telling the traveller off for not having used a
           feature yet. */
        <Empty icon="♡" text="還沒有收藏的地方或導覽。看到喜歡的按一下愛心就會出現在這裡。" />
      ) : (
        <>
          <Section title="景點" count={places.length}>
            {places.length === 0 ? (
              <Blank text="還沒有收藏的地方" />
            ) : (
              <div className="space-y-2 px-5">
                {places.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => nav.go({ k: "poi", id: p.id })}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface p-2.5 text-left transition active:bg-surface-2"
                  >
                    <PoiImage poi={p} height={56} radius={12} className="w-[74px]" emoji />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14.5px] font-semibold text-ink">
                          {p.name}
                        </span>
                        {p.storyId && <StoryBadge label={false} />}
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                        {p.area} · {POI_KIND_LABELS[p.kind]}
                      </div>
                    </div>
                    <span className="shrink-0 text-[15px] text-ink-3">›</span>
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="語音導覽" count={guides.length}>
            {guides.length === 0 ? (
              <Blank text="還沒有收藏的導覽" />
            ) : (
              <div className="space-y-2 px-5">
                {guides.map((s) => {
                  const p = poi(s.poiId);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-2xl bg-surface p-2.5"
                    >
                      <PoiThumb poi={p} size={56} radius={12} />
                      <button
                        onClick={() => nav.go({ k: "poi", id: p.id })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-[14.5px] font-semibold text-ink">
                          {p.name}
                        </div>
                        <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                          {s.hook}
                        </div>
                        <div className="num mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                          <span>★ {rating(s).toFixed(1)}</span>
                          <span>·</span>
                          <span className="truncate">{playLabel(s.plays)}</span>
                        </div>
                      </button>
                      {/* Plays the 30-second edit rather than opening the place:
                          somebody who saved a guide saved it to listen to it. */}
                      <button
                        onClick={() => nav.play(s.poiId, "short")}
                        className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-bg px-3 text-[12.5px] font-semibold text-ink transition active:bg-surface-2"
                      >
                        <Headphones size={12} />
                        30 秒
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}

      <div className="h-24 shrink-0" />
    </Screen>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline gap-2 px-5">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <span className="num text-[13px] text-ink-3">{count}</span>
      </div>
      {children}
    </section>
  );
}

/** One shelf empty while the other has something — quieter than a full Empty. */
function Blank({ text }: { text: string }) {
  return <p className="px-5 text-[13.5px] text-ink-3">{text}</p>;
}
