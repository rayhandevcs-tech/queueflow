"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;

export function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  function setDigitAt(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigitAt(index, digit);
    if (digit && index < LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    const next = digits.slice();
    for (let i = 0; i < pasted.length && index + i < LENGTH; i++) {
      next[index + i] = pasted[i];
    }
    onChange(next.join(""));
    const lastFilled = Math.min(index + pasted.length, LENGTH) - 1;
    inputRefs.current[lastFilled]?.focus();
  }

  return (
    <div className="flex justify-center gap-1 sm:gap-2" dir="ltr">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          className={cn(
            "h-11 w-11 rounded-xl border bg-card text-center font-number text-lg font-bold text-ink outline-none transition-colors sm:h-14 sm:w-12",
            invalid ? "border-live" : "border-line focus:border-accent",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
