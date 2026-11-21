"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  caretPositionForDigitIndex,
  formatVndDigits,
  normalizeVndDigits,
} from "@/lib/number-format";

type VndInputProps = {
  name: string;
  value?: string;
  defaultValue?: string | number;
  onValueChange?: (rawDigits: string) => void;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
};

function countDigitsBefore(text: string, index: number): number {
  let count = 0;
  for (let i = 0; i < Math.min(index, text.length); i++) {
    const ch = text[i];
    if (ch >= "0" && ch <= "9") count++;
  }
  return count;
}

export function VndInput({
  name,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  required,
  placeholder,
  "aria-label": ariaLabel,
  id,
  className,
  disabled,
}: VndInputProps) {
  const isControlled = value !== undefined;
  const [internalRaw, setInternalRaw] = useState(() =>
    defaultValue === undefined ? "" : normalizeVndDigits(String(defaultValue)),
  );
  const raw = isControlled ? normalizeVndDigits(value) : internalRaw;
  const formatted = formatVndDigits(raw);

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingDigitCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || pendingDigitCaret.current === null) return;
    const pos = caretPositionForDigitIndex(formatted, pendingDigitCaret.current);
    pendingDigitCaret.current = null;
    if (document.activeElement === el) {
      el.setSelectionRange(pos, pos);
    }
  }, [formatted]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!raw) {
      el.setCustomValidity("");
      return;
    }
    const num = Number(raw);
    if (!Number.isSafeInteger(num)) {
      el.setCustomValidity("Số tiền không hợp lệ.");
    } else if (min !== undefined && num < min) {
      el.setCustomValidity(`Giá trị tối thiểu là ${formatVndDigits(min)}.`);
    } else if (max !== undefined && num > max) {
      el.setCustomValidity(`Giá trị tối đa là ${formatVndDigits(max)}.`);
    } else {
      el.setCustomValidity("");
    }
  }, [raw, min, max]);

  const commit = (nextRaw: string, nextDigitCaret: number | null) => {
    pendingDigitCaret.current = nextDigitCaret;
    if (!isControlled) setInternalRaw(nextRaw);
    onValueChange?.(nextRaw);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    const cursor = event.target.selectionStart ?? text.length;
    const digitsBefore = countDigitsBefore(text, cursor);
    const nextRaw = normalizeVndDigits(text);
    const rawDigitsBefore = text.slice(0, cursor).replace(/\D/g, "");
    const strippedLeadingZeros =
      rawDigitsBefore.length > 0 &&
      /^0+\d/.test(text.replace(/\D/g, ""))
        ? text.replace(/\D/g, "").match(/^0+(?=\d)/)?.[0].length ?? 0
        : 0;
    const adjustedCaret = Math.max(0, digitsBefore - strippedLeadingZeros);
    commit(nextRaw, adjustedCaret);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const el = event.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === null || end === null || start !== end) return;

    if (event.key === "Backspace" && start > 0 && formatted[start - 1] === ".") {
      event.preventDefault();
      const digitsBefore = countDigitsBefore(formatted, start);
      if (digitsBefore <= 0) return;
      const nextRaw = normalizeVndDigits(
        raw.slice(0, digitsBefore - 1) + raw.slice(digitsBefore),
      );
      commit(nextRaw, digitsBefore - 1);
    } else if (
      event.key === "Delete" &&
      start < formatted.length &&
      formatted[start] === "."
    ) {
      event.preventDefault();
      const digitsBefore = countDigitsBefore(formatted, start);
      if (digitsBefore >= raw.length) return;
      const nextRaw = normalizeVndDigits(
        raw.slice(0, digitsBefore) + raw.slice(digitsBefore + 1),
      );
      commit(nextRaw, digitsBefore);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        className={className}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={formatted}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  );
}
