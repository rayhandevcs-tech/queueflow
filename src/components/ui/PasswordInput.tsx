"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, type Dict } from "@/lib/i18n";

const dict = {
  hide: { bn: "পাসওয়ার্ড লুকাও", en: "Hide password" },
  show: { bn: "পাসওয়ার্ড দেখাও", en: "Show password" },
} satisfies Dict;

interface Props extends Omit<React.ComponentProps<"input">, "type"> {
  invalid?: boolean;
  icon?: React.ReactNode;
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ invalid, icon, className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const t = useT(dict);

    return (
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "w-full rounded-lg border bg-card py-2.5 pr-10 text-sm text-ink shadow-xs transition-colors placeholder:text-muted/60",
            icon ? "pl-9" : "pl-3.5",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
            invalid ? "border-live/60" : "border-line",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          aria-label={visible ? t("hide") : t("show")}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
