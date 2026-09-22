import { useRef, type RefObject } from "react";

/**
 * The one search field on 更多優惠, used on the hub and again on the results.
 *
 * A real input inside a real form: Enter, the phone keyboard's 搜尋 key and the
 * button all submit the same way. The button is disabled while the field is
 * empty, because sending somebody to Klook with no keyword lands them on a
 * page of everything, which is the opposite of having searched.
 */
export function DealSearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  inputRef,
  elevated,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** On top of a photograph, where it needs a shadow to lift off the image. */
  elevated?: boolean;
}) {
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  const empty = value.trim() === "";

  const send = () => {
    if (empty) return;
    ref.current?.blur();
    onSubmit(value.trim());
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={`flex h-14 items-center gap-2 rounded-2xl bg-white pl-4 pr-1.5 ${
        elevated ? "shadow-[0_8px_24px_rgba(0,0,0,.18)]" : "ring-1 ring-line"
      }`}
    >
      <SearchIcon />
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        /* Enter is handled here as well as by the form. Implicit submission is
           not guaranteed for every key event a browser or a test driver sends,
           and the Enter that confirms a 注音 / 拼音 candidate must not search
           for half a word — `isComposing` is that Enter. */
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          send();
        }}
        placeholder={placeholder}
        aria-label="搜尋關鍵字"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {!empty && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label="清除"
          className="grid size-9 shrink-0 place-items-center rounded-full text-[18px] text-ink-3 active:bg-surface"
        >
          ×
        </button>
      )}
      <button
        type="submit"
        disabled={empty}
        className="h-11 shrink-0 rounded-xl bg-brand px-4 text-[14.5px] font-bold text-white transition active:bg-brand-press disabled:opacity-40"
      >
        搜尋
      </button>
    </form>
  );
}

export function SearchIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-ink-3"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" strokeLinecap="round" />
    </svg>
  );
}
