import { BY_ADAPT } from "../data/trips";
import { dur } from "../lib/adapt";
import { Screen, TopBar } from "../components/ui";

/**
 * Presenter controls.
 *
 * In the real product each of these fires from a clock, a GPS fix or a weather
 * poll. None of that can be relied on to happen at the right moment in front of
 * a room, so this screen exists to force them by hand — and it is the only
 * screen in the app that admits the demo is a demo.
 */
export function DemoPanel({
  onBack,
  onStartTainan,
  onTainanLate,
  onHualienRain,
  onArrive,
  onReset,
}: {
  onBack: () => void;
  onStartTainan: () => void;
  onTainanLate: () => void;
  onHualienRain: () => void;
  onArrive: () => void;
  onReset: () => void;
}) {
  const late = BY_ADAPT["tainan-late"];

  return (
    <Screen>
      <TopBar title="Demo 情境" onBack={onBack} />
      <div className="px-5 pt-2">
        <p className="text-[13.5px] leading-relaxed text-ink-3">
          正式版由時間、定位與天氣自動觸發。這裡讓你在簡報時手動叫出來。
        </p>

        <div className="mt-5 space-y-2.5">
          <Btn
            label="🏯 台南・旅行進行中"
            sub="首頁變成 Day 2，下一站赤崁樓"
            onClick={onStartTainan}
          />
          <Btn
            label="🕘 台南・行程延後"
            sub={`Day ${late.day}・晚了 ${dur(late.delayMin ?? 0)}`}
            onClick={onTainanLate}
          />
          <Btn
            label="🌧️ 花蓮・下午下雨"
            sub="Day 2・七星潭改室內，晚餐不動"
            onClick={onHualienRain}
          />
          <Btn label="📍 抵達赤崁樓" sub="跳出語音故事" onClick={onArrive} />
          <Btn label="⟲ 重置 Demo" sub="回到最初狀態" onClick={onReset} />
        </div>

        <p className="mt-6 text-[11.5px] leading-relaxed text-ink-3">
          全部資料為示意。ResoMap 參加 Klook、KKday 聯盟行銷計畫，與 Booking、Agoda、
          Trip.com 皆無合作關係。
        </p>
      </div>
      {/* shrink-0, or the spacer measures 0 in the flex column and the last
          line sits under the tab bar. */}
      <div className="h-24 shrink-0" />
    </Screen>
  );
}

function Btn({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-surface p-4 text-left active:bg-surface-2"
    >
      <div className="text-[15px] font-semibold text-ink">{label}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-3">{sub}</div>
    </button>
  );
}
