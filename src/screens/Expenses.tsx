import { useState, useSyncExternalStore, type ReactNode } from "react";
import { BY_TRAVELLER, ME } from "../data";
import { EXPENSES } from "../data/expenses";
import { balances, byCategory, settle, shares, total } from "../lib/split";
import { useNav } from "../nav";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  Note,
  Screen,
  Section,
  Segmented,
  Sheet,
  TopBar,
} from "../components/ui";
import {
  EXPENSE_ICONS,
  EXPENSE_LABELS,
  type Expense,
  type ExpenseCategory,
  type SplitMode,
  type Transfer,
  type TravellerId,
  type Trip,
} from "../types";

/**
 * 旅費 — the money half of travelling together.
 *
 * Every figure on these three screens is computed by `lib/split.ts` from one
 * receipt list. Nothing is hard-coded: adding a bill in the sheet moves the
 * total, the category totals, everybody's balance and the settlement screen,
 * because they are all reads of the same array. A 旅費 screen whose summary can
 * disagree with the receipts printed underneath it is worse than no summary.
 *
 * Which is also why there is no chart and no average on it. Every number here
 * is one somebody could check against a receipt in their pocket; a mean or a
 * proportional bar is a figure with no receipt behind it, and one of those next
 * to eleven real ones is enough to make the reader doubt all twelve.
 */

const nt = (n: number) => `NT$ ${n.toLocaleString()}`;

/**
 * Who this trip's money is split between.
 *
 * A trip may legitimately carry no travellers — one created from a destination
 * page starts solo, because group coordination is optional everywhere else in
 * the app. Then it is just you. This used to fall back to the whole demo cast so
 * that 分攤 always had somebody to divide by, which put three names the traveller
 * never invited under 一起分攤 on a trip they are taking alone — inventing
 * companions to justify a feature is the wrong way round.
 *
 * Anybody named on a receipt is then unioned in, and that part is not cosmetic.
 * `balances()` only returns rows for the people it is handed: hand it a roster
 * that misses a payer and their outlay is counted against nobody, so the column
 * silently stops summing to zero and the settlement under-collects by exactly
 * what they spent. The union makes that unrepresentable rather than relying on
 * the roster and the receipts happening to agree.
 */
function peopleOf(trip: Trip | undefined, list: Expense[]): TravellerId[] {
  const roster = trip && trip.travellers.length > 0 ? trip.travellers : [ME.id];
  const out = [...roster];
  for (const e of list) {
    for (const w of [e.paidBy, ...e.forWhom]) if (!out.includes(w)) out.push(w);
  }
  return out;
}

const nameOf = (id: TravellerId) => BY_TRAVELLER[id].name;

/**
 * The receipts, shared by 旅費 and 結算.
 *
 * They cannot be 旅費's component state. 結算 is a separate route reading the
 * same trip, so a list held inside 旅費 means the bill just entered is missing
 * from the settlement one tap later: 你應收 on one screen and the 建議付款 on
 * the next get computed from two different sets of receipts, which is precisely
 * the disagreement this file's header promises cannot happen. Module scope plus
 * a subscription is the smallest thing that keeps both screens — and the sheet's
 * own roster — reading one array.
 */
let RECEIPTS: Expense[] = EXPENSES;
const watchers = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

function addReceipt(e: Expense) {
  RECEIPTS = [...RECEIPTS, e];
  for (const fn of watchers) fn();
}

/**
 * Put the receipts back to the fixtures.
 *
 * The demo reset restores the trips but lives outside React for the money, so
 * without this a bill entered during one run-through survives into the next —
 * the presenter shows 記一筆, resets, and 總支出 is still NT$ 12,540.
 */
export function resetReceipts() {
  RECEIPTS = EXPENSES;
  for (const fn of watchers) fn();
}

/**
 * This trip's receipts, live.
 *
 * The snapshot is the module array itself, not a filtered copy: returning a
 * freshly built array from `getSnapshot` hands React a new reference on every
 * call, which it reads as "changed again" and re-renders forever. Filtering
 * happens after the subscription, where a new array costs nothing.
 */
export function useReceipts(tripId: string): Expense[] {
  const all = useSyncExternalStore(subscribe, () => RECEIPTS);
  return all.filter((e) => e.tripId === tripId);
}

/* ---------------------------------------------------------------- 旅費 */

export function Expenses({ tripId, add }: { tripId: string; add?: boolean }) {
  const nav = useNav();
  const trip = nav.trips.find((t) => t.id === tripId);

  const list = useReceipts(tripId);
  /* Opened already adding when it came from the ＋ on the trip's 共同記帳 card —
     that tap meant "record something", not "show me the ledger first". */
  const [adding, setAdding] = useState(Boolean(add));

  const people = peopleOf(trip, list);
  const sum = total(list);
  const cats = byCategory(list);
  const days = groupByDay(list);

  /* The reader's own position, taken from the same balances the 結算 screen
     prints. This replaced a 平均每人 tile, which was arithmetically fine and
     factually useless: 總支出 ÷ 人數 is NT$ 2,885 on the demo receipts, and the
     four actual shares are 3,370 / 2,650 / 2,820 / 2,700 — a headline figure
     that matches nobody, sitting directly above the list that contradicts it.
     A mean is only honest on a screen where the bills were even, which is the
     one case this feature does not exist for. */
  const mine = balances(list, people).find((b) => b.who === ME.id);

  return (
    <Screen>
      <TopBar title="旅費" onBack={nav.back} />

      {trip && (
        <div className="num px-5 text-[14px] text-ink-3">
          {trip.title} · {trip.dates}
        </div>
      )}

      <div className="px-5 pt-4">
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-[12.5px] font-semibold text-ink-3">總支出</div>
          <div className="num mt-1 text-[30px] font-bold leading-none text-ink">
            {nt(sum)}
          </div>

          {/* One line, not a pair of tiles. Two figures side by side under a
              big number is a dashboard, and the question somebody opens 旅費
              with is singular: where do I stand. */}
          {/* `list.length` as well as `mine`: on a trip with no receipts the net
              is 0, and 你已經結清了 announces the settling of a debt nobody ever
              had. An empty ledger has nothing to report about your position. */}
          {mine && list.length > 0 && (
            <div className="mt-3 text-[14px] text-ink-2">
              {Math.abs(mine.net) < 1 ? (
                <>你已經結清了</>
              ) : (
                <>
                  你{mine.net > 0 ? "應收" : "應付"}{" "}
                  <span className="num font-bold text-ink">{nt(Math.abs(mine.net))}</span>
                </>
              )}
            </div>
          )}

          {/* One person cannot 一起分攤 with themselves. A solo trip's ledger is
              a record of what you spent, and saying so is both true and the
              honest way to keep the feature useful on a trip of one. */}
          <div className="mt-3.5 flex items-center gap-2.5 border-t border-line pt-3">
            <Stack who={people} size={24} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-3">
              {people.length > 1 ? `${people.map(nameOf).join("、")} 一起分攤` : "只有你一個人的花費"}
            </span>
          </div>
        </div>
      </div>

      {/* Money and labels, no bars. A row of proportional rules is the one
          dashboard gesture this app keeps off every screen except 商業模式, and
          it earns nothing here: the amounts are already sorted largest first, so
          the ranking the bar would draw is the order the reader is reading in.
          Not truncated either — `byCategory` only returns categories that
          actually occur, and there are six in total, so the list can never be
          showing a partial picture under a heading that implies the whole. */}
      {cats.length > 0 && (
        <Section title="花在哪裡" tight>
          <div className="px-5">
            {cats.map((c) => (
              <div key={c.category} className="flex items-baseline gap-3 py-2.5">
                <span className="w-6 shrink-0 text-center text-[16px]">
                  {EXPENSE_ICONS[c.category]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                  {EXPENSE_LABELS[c.category]}
                </span>
                <span className="num shrink-0 text-[14px] font-semibold text-ink">
                  {nt(c.twd)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="明細" tight>
        {list.length === 0 ? (
          <Empty icon="🧾" text="這趟還沒有記過任何一筆。" />
        ) : (
          <div className="space-y-5 px-5">
            {days.map((g) => (
              <div key={g.day}>
                <div className="num pb-1 text-[12.5px] font-semibold text-ink-3">
                  Day {g.day} · {g.date}
                </div>
                {g.items.map((e) => (
                  <ExpenseRow key={e.id} expense={e} everybody={people} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Only where there are receipts to describe. On an empty ledger this
          labelled a set of Demo receipts that is not on the screen — and the
          first bill entered there is the traveller's own, not demo data. */}
      {list.length > 0 && (
        <Note>這趟的收據是 Demo 資料，用來示範分攤與結算怎麼算出來。</Note>
      )}

      {/* `shrink-0`, or an empty div in a flex column measures 0 and the last
          receipt runs into the bar below. */}
      <div className="h-24 shrink-0" />

      {/* In flow as well as sticky, so nothing is permanently covered by it. */}
      <div className="sticky bottom-0 z-20 mt-auto shrink-0 border-t border-line bg-bg/95 px-5 pb-5 pt-3 backdrop-blur">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Button onClick={() => setAdding(true)}>＋ 記一筆</Button>
          </div>
          <Button
            variant="ghost"
            full={false}
            onClick={() => nav.go({ k: "settle", tripId })}
          >
            結算
          </Button>
        </div>
      </div>

      {adding && (
        <AddExpense
          tripId={tripId}
          onClose={() => setAdding(false)}
          onSave={(e) => {
            addReceipt(e);
            setAdding(false);
          }}
        />
      )}
    </Screen>
  );
}

function ExpenseRow({
  expense: e,
  everybody,
}: {
  expense: Expense;
  everybody: TravellerId[];
}) {
  /* Naming the payers only when they are not everybody. On a bill the whole
     group shared, the line is noise; on the one two people skipped, it is the
     entire reason the numbers below do not divide by four.

     Containment, not a count. `everybody` is the roster unioned with everyone
     named on a receipt, so it can hold four people while a four-way bill covers
     a different four — and a length test would stay silent on exactly the bill
     whose split needs explaining. */
  const partial = everybody.some((w) => !e.forWhom.includes(w));

  return (
    <div className="flex gap-3 border-b border-line py-3 last:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-[15px]">
        {EXPENSE_ICONS[e.category]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">
            {e.note}
          </span>
          <span className="num shrink-0 text-[14.5px] font-semibold text-ink">
            {nt(e.amountTwd)}
          </span>
        </div>
        <div className="mt-0.5 text-[12.5px] text-ink-3">{nameOf(e.paidBy)} 付</div>
        {partial && (
          <div className="mt-0.5 text-[12px] leading-relaxed text-ink-3">
            由 {e.forWhom.map(nameOf).join("、")} 分攤
          </div>
        )}
      </div>
    </div>
  );
}

interface DayGroup {
  day: number;
  date: string;
  items: Expense[];
}

function groupByDay(list: Expense[]): DayGroup[] {
  const m = new Map<number, DayGroup>();
  for (const e of list) {
    const g = m.get(e.day) ?? { day: e.day, date: e.date, items: [] };
    g.items.push(e);
    m.set(e.day, g);
  }
  return [...m.values()].sort((a, b) => a.day - b.day);
}

/* ------------------------------------------------------------- 記一筆 */

const MODES: { id: SplitMode; label: string }[] = [
  { id: "even", label: "平均分" },
  { id: "amount", label: "自訂金額" },
  { id: "share", label: "自訂比例" },
];

const CATEGORIES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];

/**
 * One bill, entered the way it actually happened.
 *
 * The three split modes are the whole point. An app that can only divide by the
 * number of people at the table is fine until the evening somebody skips the
 * beef soup, and then it is a spreadsheet. 自訂金額 refuses to save a split that
 * does not add up to the bill — quietly accepting NT$800 of shares against a
 * NT$1,000 receipt would put a wrong number into every screen downstream.
 */
export function AddExpense({
  tripId,
  onClose,
  onSave,
}: {
  tripId: string;
  onClose: () => void;
  onSave: (e: Expense) => void;
}) {
  const nav = useNav();
  const trip = nav.trips.find((t) => t.id === tripId);
  /* The live receipts, not the fixtures — otherwise somebody added to the trip
     by an earlier bill is missing from 誰付款 in the sheet that follows it. */
  const list = useReceipts(tripId);
  const people = peopleOf(trip, list);
  const day = trip?.today ?? 1;
  const date = trip?.days.find((d) => d.n === day)?.date ?? trip?.days[0]?.date ?? "";

  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [paidBy, setPaidBy] = useState<TravellerId>(
    people.includes(ME.id) ? ME.id : people[0],
  );
  const [forWhom, setForWhom] = useState<TravellerId[]>(people);
  const [mode, setMode] = useState<SplitMode>("even");
  const [custom, setCustom] = useState<Partial<Record<TravellerId, string>>>({});
  const [note, setNote] = useState("");

  const amount = Number(amountText) || 0;

  /* The custom column, as numbers. TWD in 自訂金額, a relative weight in
     自訂比例 — `shares()` reads both out of the same field. */
  const weights: Partial<Record<TravellerId, number>> = {};
  for (const w of forWhom) weights[w] = Number(custom[w]) || 0;
  const entered = forWhom.reduce((a, w) => a + (weights[w] ?? 0), 0);
  const off = amount - entered;

  /* The live preview and the saved record go through the same function, so
     what the sheet shows is what the 明細 will compute afterwards. */
  const draft: Expense = {
    id: "draft",
    tripId,
    amountTwd: amount,
    category,
    note,
    paidBy,
    forWhom,
    mode,
    custom: mode === "even" ? undefined : weights,
    day,
    date,
  };
  const cut = shares(draft);
  const cuts = forWhom.map((w) => cut[w] ?? 0);
  const lo = cuts.length > 0 ? Math.min(...cuts) : 0;
  const hi = cuts.length > 0 ? Math.max(...cuts) : 0;

  const problem = check();

  function check(): string | null {
    if (amount <= 0) return "請先填金額";
    if (forWhom.length === 0) return "請選擇為誰付款";
    if (mode === "amount" && off !== 0) {
      return off > 0 ? `每個人加起來還差 ${nt(off)}` : `每個人加起來超出 ${nt(-off)}`;
    }
    if (mode === "share" && entered <= 0) return "請至少給一個人比例";
    return null;
  }

  function toggleFor(id: TravellerId) {
    setForWhom((l) =>
      l.includes(id)
        ? l.filter((x) => x !== id)
        : /* Rebuilt from `people` so the row keeps one stable order. */
          people.filter((p) => l.includes(p) || p === id),
    );
  }

  function save() {
    if (problem) return;
    onSave({
      id: `ex-${Date.now()}`,
      tripId,
      amountTwd: amount,
      category,
      /* An unlabelled receipt reads as a bug three days later. */
      note: note.trim() || EXPENSE_LABELS[category],
      paidBy,
      forWhom: [...forWhom],
      mode,
      custom: mode === "even" ? undefined : { ...weights },
      day,
      date,
    });
  }

  return (
    <Sheet open onClose={onClose} title="記一筆">
      <div className="px-5">
        <Field label="金額">
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3">
            <span className="shrink-0 text-[15px] font-semibold text-ink-3">NT$</span>
            <input
              value={amountText}
              onChange={(ev) => setAmountText(ev.target.value.replace(/\D/g, "").slice(0, 7))}
              inputMode="numeric"
              placeholder="0"
              aria-label="金額"
              className="num min-w-0 flex-1 bg-transparent text-[28px] font-bold text-ink outline-none placeholder:text-ink-3"
            />
          </div>
        </Field>

        <Field label="分類">
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {CATEGORIES.map((c) => (
              <Chip key={c} active={c === category} onClick={() => setCategory(c)}>
                {EXPENSE_ICONS[c]} {EXPENSE_LABELS[c]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="誰付款">
          <PersonRow
            people={people}
            on={(id) => id === paidBy}
            onTap={(id) => setPaidBy(id)}
          />
        </Field>

        <Field label="為誰付款">
          <PersonRow people={people} on={(id) => forWhom.includes(id)} onTap={toggleFor} />
        </Field>

        <Field label="分法">
          <div className="flex min-h-11 items-center">
            <Segmented items={MODES} value={mode} onChange={setMode} />
          </div>

          {mode === "even" && (
            <div className="mt-2 text-[13.5px] text-ink-2">
              {forWhom.length === 0
                ? "還沒有人要分這筆"
                : lo === hi
                  ? `${forWhom.length} 人平均，每人 ${nt(lo)}`
                  : `${forWhom.length} 人平均，每人 ${nt(lo)} 或 ${nt(hi)}`}
            </div>
          )}

          {mode === "amount" && (
            <div className="mt-3">
              {forWhom.map((w) => (
                <div key={w} className="flex min-h-11 items-center gap-3 py-1">
                  <Face id={w} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {nameOf(w)}
                  </span>
                  <MoneyInput
                    value={custom[w] ?? ""}
                    onChange={(v) => setCustom((c) => ({ ...c, [w]: v }))}
                    label={`${nameOf(w)} 分攤金額`}
                  />
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between text-[12.5px]">
                <span className="text-ink-3">已分配</span>
                <span className="num font-semibold text-ink">
                  {nt(entered)} / {nt(amount)}
                </span>
              </div>
            </div>
          )}

          {mode === "share" && (
            <div className="mt-3">
              {forWhom.map((w) => (
                <div key={w} className="flex min-h-11 items-center gap-3 py-1">
                  <Face id={w} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {nameOf(w)}
                  </span>
                  <span className="num shrink-0 text-[13px] text-ink-3">
                    {entered > 0 ? nt(cut[w] ?? 0) : "—"}
                  </span>
                  <input
                    value={custom[w] ?? ""}
                    onChange={(ev) =>
                      setCustom((c) => ({ ...c, [w]: ev.target.value.replace(/\D/g, "").slice(0, 3) }))
                    }
                    inputMode="numeric"
                    placeholder="1"
                    aria-label={`${nameOf(w)} 比例`}
                    className="num h-11 w-[58px] shrink-0 rounded-xl bg-surface text-center text-[15px] font-semibold text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
              ))}
              <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                比例是相對的：2 和 1 就是一個人付兩份、一個人付一份。
              </p>
            </div>
          )}
        </Field>

        <Field label="備註">
          <input
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="例如：國華街晚餐"
            aria-label="備註"
            className="h-12 w-full rounded-2xl bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
        </Field>

        <Field label="日期">
          <div className="flex h-12 items-center justify-between rounded-2xl bg-surface px-4">
            <span className="num text-[14.5px] text-ink">
              Day {day} · {date}
            </span>
            <span className="text-[12px] text-ink-3">行程當天</span>
          </div>
        </Field>
      </div>

      <div className="sticky bottom-0 mt-5 bg-bg px-5 pt-3">
        {problem && amount > 0 && (
          <p className="mb-2 text-[12.5px] text-warn">{problem}</p>
        )}
        <Button onClick={save} disabled={Boolean(problem)}>
          儲存
        </Button>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[12.5px] font-semibold text-ink-3">{label}</div>
      {children}
    </div>
  );
}

/**
 * A row of people to pick from.
 *
 * Selected is ink, not brand orange: 為誰付款 starts with everybody chosen, and
 * four orange pills would be a wash of the one colour this app reserves for the
 * single loudest thing on a screen.
 */
function PersonRow({
  people,
  on,
  onTap,
}: {
  people: TravellerId[];
  on: (id: TravellerId) => boolean;
  onTap: (id: TravellerId) => void;
}) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
      {people.map((id) => {
        const t = BY_TRAVELLER[id];
        const active = on(id);
        return (
          <button
            key={id}
            onClick={() => onTap(id)}
            aria-pressed={active}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[13.5px] font-semibold transition ${
              active ? "bg-ink text-white" : "bg-surface text-ink-2 active:bg-surface-2"
            }`}
          >
            <Avatar color={t.color} initial={t.initial} size={30} />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex h-11 w-[116px] shrink-0 items-center gap-1 rounded-xl bg-surface px-3">
      <span className="shrink-0 text-[12px] text-ink-3">NT$</span>
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value.replace(/\D/g, "").slice(0, 7))}
        inputMode="numeric"
        placeholder="0"
        aria-label={label}
        className="num w-full min-w-0 bg-transparent text-right text-[15px] font-semibold text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

/* -------------------------------------------------------------- 結算 */

const keyOf = (t: Transfer) => `${t.from}-${t.to}-${t.amount}`;

/**
 * Who pays whom, in the fewest payments that clear it.
 *
 * The balances stay as the receipts computed them; 標記已結清 only takes a
 * suggested payment off the list. ResoMap does not move money in T0, and a
 * button that silently rewrote everyone's position would be claiming it does.
 */
export function Settle({ tripId }: { tripId: string }) {
  const nav = useNav();
  const trip = nav.trips.find((t) => t.id === tripId);
  const list = useReceipts(tripId);
  const people = peopleOf(trip, list);

  /* What has been ticked off, by identity — not a snapshot of the payment list
     taken once at mount. A list frozen on the first render survives a bill
     being added to the same trip and goes on suggesting payments that the
     receipts no longer imply, directly under a balance column that has already
     moved. Keying on the amount as well as the pair is deliberate: when the
     receipts change, a payment of a different size is a different payment and
     has to come back unticked. */
  const [cleared, setCleared] = useState<string[]>([]);

  const nets = balances(list, people);
  const open = settle(list, people).filter((t) => !cleared.includes(keyOf(t)));

  return (
    <Screen>
      <TopBar title="結算" onBack={nav.back} />

      {trip && (
        <div className="num px-5 text-[14px] text-ink-3">
          {trip.title} · {trip.dates}
        </div>
      )}

      <Section title="誰該收、誰該付">
        <div className="px-5">
          {nets.map((b) => {
            const t = BY_TRAVELLER[b.who];
            return (
              <div
                key={b.who}
                className="flex items-center gap-3 border-b border-line py-3 last:border-0"
              >
                <Avatar name={t.name} color={t.color} initial={t.initial} size={36} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                  {t.name}
                </span>
                {/* The same sub-dollar threshold `settle()` uses. On `=== 0` a
                    net of NT$0.40 printed 應收 NT$ 0 next to a payment list that
                    correctly ignored it — the balances and the transfers have to
                    agree on what "square" means or neither is trustworthy. */}
                {Math.abs(b.net) < 1 ? (
                  <span className="shrink-0 text-[13px] text-ink-3">已結清</span>
                ) : (
                  <span className="shrink-0 text-right">
                    <span className="text-[12px] text-ink-3">
                      {b.net > 0 ? "應收" : "應付"}
                    </span>{" "}
                    <span
                      className={`num text-[15.5px] font-bold ${
                        b.net > 0 ? "text-ok" : "text-ink"
                      }`}
                    >
                      {nt(Math.abs(b.net))}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="建議付款" tight>
        {open.length === 0 ? (
          /* Not "都結清了". Ticking the last suggestion off does not settle
             anybody — the column directly above still reads 應收 NT$ 3,650,
             and a screen that claims otherwise two sections down is telling the
             reader their money arrived. It says what actually happened. */
          <Empty
            icon="✅"
            text={
              cleared.length > 0
                ? "建議付款都標記過了。上面的餘額還是收據算出來的。"
                : "沒有人需要付給誰。"
            }
          />
        ) : (
          <div className="space-y-2 px-5">
            {open.map((t) => (
              <div key={keyOf(t)} className="rounded-2xl bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Face id={t.from} />
                  <span className="text-[14.5px] font-semibold text-ink">
                    {nameOf(t.from)}
                  </span>
                  <span className="text-[14px] text-ink-3">→</span>
                  <Face id={t.to} />
                  <span className="text-[14.5px] font-semibold text-ink">
                    {nameOf(t.to)}
                  </span>
                  <span className="num ml-auto text-[15.5px] font-bold text-ink">
                    {nt(t.amount)}
                  </span>
                </div>
                <button
                  onClick={() => setCleared((c) => [...c, keyOf(t)])}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full bg-bg px-4 text-[13px] font-semibold text-ink transition active:bg-surface-2"
                >
                  標記已結清
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Note>
        ResoMap 不經手金流。標記已結清只是把這筆從清單移除，留下這趟旅程的結算紀錄，
        錢還是你們自己轉。
      </Note>

      <div className="h-24 shrink-0" />
    </Screen>
  );
}

/* ------------------------------------------------------------------ bits */

function Face({ id, size = 24 }: { id: TravellerId; size?: number }) {
  const t = BY_TRAVELLER[id];
  return <Avatar name={t.name} color={t.color} initial={t.initial} size={size} />;
}

function Stack({ who, size }: { who: TravellerId[]; size: number }) {
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {who.map((id) => (
        <span key={id} className="rounded-full ring-2 ring-surface">
          <Face id={id} size={size} />
        </span>
      ))}
    </div>
  );
}
