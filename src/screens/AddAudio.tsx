import { useMemo, useRef, useState } from "react";
import { POIS, poi } from "../data";
import { BY_DEST } from "../data/destinations";
import { Button, Note, Screen, TopBar } from "../components/ui";
import { PoiThumb } from "../components/Cover";
import { addDraft, useAccount } from "../lib/account";
import { HOME_LANGUAGE } from "../lib/audio";
import { useNav } from "../nav";

/**
 * Recording a guide, as six questions.
 *
 * One question per screen, and the footer button is the only way forward — the
 * same shape as CreateTrip. A single long form with six fields is faster to
 * build and is the version people abandon on a phone.
 *
 * **Nothing is uploaded.** The file picker is real — it reads the name of the
 * file off the traveller's own device and never sends it anywhere — because a
 * fake 「已選擇檔案」 button teaches nothing about the flow, while a real picker
 * that does not upload is exactly what a prototype of this step should be. The
 * last screen says so plainly rather than implying a queue exists.
 */

const STEPS = ["音檔", "語言", "標題", "景點", "說明", "送審"] as const;

const LANGUAGES = [
  HOME_LANGUAGE,
  "English",
  "日本語",
  "한국어",
  "ไทย",
  "Bahasa Indonesia",
  "Filipino",
  "Tiếng Việt",
];

export function AddAudio({ poiId }: { poiId?: string }) {
  const nav = useNav();
  const account = useAccount();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [language, setLanguage] = useState(HOME_LANGUAGE);
  const [title, setTitle] = useState("");
  const [spot, setSpot] = useState(poiId ?? "");
  const [description, setDescription] = useState("");
  const [q, setQ] = useState("");
  const [done, setDone] = useState(false);

  const spotPoi = spot ? poi(spot) : undefined;

  /* Search over the whole POI set, which is what somebody standing in a place
     the app has not heard of will do first. Matching the city name too, because
     「台南」 is how people look for 赤崁樓. */
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = needle
      ? POIS.filter((p) =>
          [p.name, p.area, BY_DEST[p.destId]?.name ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : POIS;
    return pool.slice(0, 24);
  }, [q]);

  const canGo = [
    Boolean(fileName),
    Boolean(language),
    title.trim().length >= 2,
    Boolean(spotPoi),
    description.trim().length >= 10,
    true,
  ][step];

  function submit() {
    if (!spotPoi) return;
    addDraft({ fileName, language, title: title.trim(), poiId: spot, description: description.trim() });
    setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <TopBar title="送出成功" onBack={() => nav.back()} />
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <div className="text-5xl">📮</div>
            <h1 className="mt-4 text-[20px] font-bold text-ink">已送出，等待 ResoMap 審核</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
              審核通過後會出現在「{spotPoi?.name}」的語音清單裡。
              <br />
              目前已送審 {account.drafts.length} 則。
            </p>
            <div className="mt-6 w-full space-y-2">
              <Button onClick={() => nav.go({ k: "pro" })}>看我上傳的語音</Button>
              <Button
                variant="ghost"
                onClick={() => (spot ? nav.go({ k: "audios", poiId: spot }) : nav.back())}
              >
                回到語音清單
              </Button>
            </div>
          </div>
        </div>
        <Note>音檔不會離開你的裝置，這筆記錄只儲存在本機。</Note>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        title="新增語音導覽"
        onBack={() => (step === 0 ? nav.back() : setStep((s) => s - 1))}
        below={
          <div className="flex gap-1 px-5 pb-3">
            {STEPS.map((label, i) => (
              <span key={label} className="min-w-0 flex-1">
                <span
                  className={`block h-1 rounded-full ${
                    i <= step ? "bg-brand" : "bg-surface-2"
                  }`}
                />
                <span
                  className={`mt-1 block truncate text-center text-[10.5px] ${
                    i === step ? "font-semibold text-ink-2" : "text-ink-3"
                  }`}
                >
                  {label}
                </span>
              </span>
            ))}
          </div>
        }
      />

      <div className="flex-1 px-5 pt-4">
        {step === 0 && (
          <Q title="選一段錄好的音檔" note="30 秒到 5 分鐘。檔案不會離開這台裝置。">
            {/* A real picker. It reads the filename locally and uploads
                nothing — which is both honest and more useful than a button
                that pretends. */}
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFileName(f.name);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className={`grid min-h-[132px] w-full place-items-center rounded-2xl border-2 border-dashed px-4 text-center transition ${
                fileName
                  ? "border-brand bg-brand-wash"
                  : "border-line bg-surface active:bg-surface-2"
              }`}
            >
              <span>
                <span className="block text-[26px]" aria-hidden>
                  {fileName ? "✓" : "⬆"}
                </span>
                <span className="mt-1.5 block text-[14.5px] font-bold text-ink">
                  {fileName || "選擇音檔"}
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-3">
                  {fileName ? "點一下可以換一個" : "支援 mp3 / m4a / wav"}
                </span>
              </span>
            </button>

            {/* Somebody demoing this on a machine with no audio files still has
                to be able to walk the whole flow. */}
            <button
              onClick={() => setFileName("demo-guide.m4a")}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-surface text-[13.5px] font-semibold text-ink-2 active:bg-surface-2"
            >
              沒有檔案？用示範音檔
            </button>
          </Q>
        )}

        {step === 1 && (
          <Q
            title="這段是用什麼語言錄的"
            note={`只有${HOME_LANGUAGE}目前一定播得出聲音，其他語言看裝置有沒有裝語音。`}
          >
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`min-h-11 rounded-full px-4 text-[13.5px] font-semibold transition ${
                    l === language
                      ? "bg-brand text-white"
                      : "bg-surface text-ink-2 active:bg-surface-2"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Q>
        )}

        {step === 2 && (
          <Q title="幫這段導覽取個標題" note="旅客在清單上先看到的就是這一行。">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：龍山寺・從哪個門進去"
              className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
            <div className="num mt-1.5 text-right text-[11.5px] text-ink-3">
              {title.trim().length} / 40
            </div>
          </Q>
        )}

        {step === 3 && (
          <Q title="這段是關於哪個地方" note="選了之後，這則語音會掛在那個景點的清單上。">
            {spotPoi && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-wash p-3">
                <PoiThumb poi={spotPoi} size={44} radius={12} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-ink">
                    {spotPoi.name}
                  </div>
                  <div className="truncate text-[12.5px] text-ink-3">
                    {[BY_DEST[spotPoi.destId]?.name, spotPoi.area].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-brand">已選</span>
              </div>
            )}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋景點或城市"
              className="w-full rounded-2xl bg-surface px-4 py-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
            />
            <div className="mt-2 max-h-[320px] overflow-y-auto no-scrollbar">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSpot(p.id)}
                  className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0 active:bg-surface"
                >
                  <PoiThumb poi={p} size={40} radius={10} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">
                      {p.name}
                    </span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {[BY_DEST[p.destId]?.name, p.area].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {p.id === spot && (
                    <span className="shrink-0 text-[14px] text-brand" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Q>
        )}

        {step === 4 && (
          <Q
            title="簡單說一下這段在講什麼"
            note="審核的人會看這段。寫得具體一點會過得比較快。"
          >
            <textarea
              value={description}
              rows={6}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：講龍山寺三個門的走法、月老殿排隊的時間，還有晚上六點誦經的樣子。"
              className="w-full resize-none rounded-2xl bg-surface px-4 py-3.5 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
            />
            <div className="num mt-1.5 text-right text-[11.5px] text-ink-3">
              {description.trim().length} 字{description.trim().length < 10 ? "（至少 10 字）" : ""}
            </div>
          </Q>
        )}

        {step === 5 && (
          <Q title="送出前確認一下" note="送出後會進入 ResoMap 審核，通過才會上架。">
            <div className="space-y-2">
              <Row label="音檔" value={fileName} />
              <Row label="語言" value={language} />
              <Row label="標題" value={title.trim()} />
              <Row label="景點" value={spotPoi?.name ?? "—"} />
              <Row label="說明" value={description.trim()} multiline />
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
              審核會看內容與這個地點的關聯、音質，以及是否為未標示的商業內容。
            </p>
          </Q>
        )}
      </div>

      <div className="sticky bottom-0 z-20 shrink-0 border-t border-line bg-bg/95 px-5 pb-5 pt-3 backdrop-blur">
        <Button
          disabled={!canGo}
          onClick={() => (step === STEPS.length - 1 ? submit() : setStep((s) => s + 1))}
        >
          {step === STEPS.length - 1 ? "送出審核" : "下一步"}
        </Button>
      </div>
    </Screen>
  );
}

function Q({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rm-in">
      <h1 className="text-[20px] font-bold leading-snug text-ink">{title}</h1>
      <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-ink-3">{note}</p>
      {children}
    </div>
  );
}

/* Named Row locally rather than imported: ui.tsx's Row is a tappable list row
   with a chevron, and this is a read-only summary line. Same word, different
   job — so it stays in this file instead of overloading the shared one. */
function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div
        className={`mt-0.5 text-[14px] text-ink ${multiline ? "leading-relaxed" : "truncate"}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
