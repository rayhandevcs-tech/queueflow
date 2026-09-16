"use client";

import { useState } from "react";
import { Award, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { adminDict } from "../lib/i18n";
import {
  LOYALTY_RATE_MAX,
  LOYALTY_RATE_MIN,
  validateLoyaltyRate,
} from "@/lib/loyalty-rate";
import { usePlatformLoyaltyDefault, useSetPlatformLoyaltyDefault } from "../hooks/use-admin";

/**
 * The platform's default loyalty earning rate.
 *
 * Worth being precise about what this card is, because the obvious reading is
 * wrong: it is NOT a switch that changes what shops earn. Every shop owns its
 * own `loyalty_settings.taka_per_point` and edits it on its own /loyalty page.
 * This is the number a shop *starts* from. Moving it cannot touch a programme
 * that is already running, and it cannot touch a point that has already been
 * awarded — `loyalty_transactions` is append-only and nothing here writes to
 * it. The card says so in as many words, because an admin who believes
 * otherwise would be afraid to use it.
 *
 * Authorisation is not this component's job. `admin_set_loyalty_default()`
 * checks the caller's level in SQL on its first line and refuses anyone who is
 * not a SUPER_ADMIN — a MODERATOR included. What the UI does is translate that
 * refusal into a sentence instead of a raw Postgres error.
 */
export function PlatformLoyaltyCard() {
  const t = useT(adminDict);
  const showToast = useToast();
  const { data: current, isPending, isError } = usePlatformLoyaltyDefault();
  const save = useSetPlatformLoyaltyDefault();

  // Deliberately a string, not a number. A number-typed state turns a
  // half-typed "" into 0 and then complains about a value the person never
  // entered; keeping the raw text lets "required" and "out of range" stay
  // different messages.
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const value = draft === "" ? String(current ?? "") : draft;
  const parsed = Number(value);
  const dirty = draft !== "" && Number.isFinite(parsed) && parsed !== current;

  // The rule lives in shared code and is unit-tested there; this only turns
  // its answer into a sentence.
  function validate(raw: string): string | null {
    switch (validateLoyaltyRate(raw)) {
      case "required":
        return t("loyaltyErrRequired");
      case "not-integer":
        return t("loyaltyErrInteger");
      case "out-of-range":
        return t("loyaltyErrRange");
      default:
        return null;
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(value);
    setError(problem);
    if (problem) return;

    save.mutate(Number(value), {
      onSuccess: () => {
        setDraft("");
        setError(null);
        showToast(t("loyaltySaved"));
      },
      onError: (err) => {
        // The RPC raises `not authorised` for a caller who is not a
        // SUPER_ADMIN. That is the one failure worth naming in the person's
        // own words — everything else is genuinely unexpected and reads
        // better as the message the database gave.
        const message = err instanceof Error ? err.message : "";
        setError(/not authoris/i.test(message) ? t("loyaltyErrNotAllowed") : message);
      },
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Award className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] leading-tight font-bold text-ink">
            {t("loyaltyCardTitle")}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t("loyaltyCardBody")}</p>
        </div>
      </div>

      {isPending ? (
        <div className="grid min-h-24 place-items-center">
          <Spinner className="size-5 text-muted" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-soft px-4 py-3">
            <span className="text-[12px] font-semibold tracking-wide text-muted uppercase">
              {t("loyaltyCurrentLabel")}
            </span>
            <span className="font-display text-[20px] leading-none font-bold text-ink">
              {/* A read failure must not render as "৳0 = 1 point", which is a
                  sentence about the product rather than about the network. */}
              {isError ? "—" : t("loyaltyRatePreview", String(current))}
            </span>
            <Badge variant="good" className="ml-auto gap-1">
              <Info className="size-3" />
              {t("loyaltyNoteHistorical")}
            </Badge>
          </div>

          <form onSubmit={submit} className="mt-4">
            <label
              htmlFor="loyalty-default"
              className="mb-1.5 block text-[13px] font-semibold text-ink"
            >
              {t("loyaltyRateLabel")}
            </label>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1 basis-40">
                <Input
                  id="loyalty-default"
                  type="number"
                  inputMode="numeric"
                  min={LOYALTY_RATE_MIN}
                  max={LOYALTY_RATE_MAX}
                  step={1}
                  value={value}
                  invalid={!!error}
                  aria-describedby="loyalty-default-help"
                  aria-invalid={!!error}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError(validate(e.target.value));
                  }}
                />
              </div>
              <Button type="submit" loading={save.isPending} disabled={!dirty} className="shrink-0">
                {t("loyaltySave")}
              </Button>
            </div>
            <p id="loyalty-default-help" className="mt-1.5 text-[12px] leading-snug text-muted">
              {error ? <span className="font-semibold text-live">{error}</span> : t("loyaltyRateHelp")}
            </p>
          </form>
        </>
      )}
    </Card>
  );
}
