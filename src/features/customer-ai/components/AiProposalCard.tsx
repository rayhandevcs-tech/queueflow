"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useNowMs } from "@/hooks/use-now";
import { useT } from "@/lib/i18n";
// The app's own language-aware numeral helper — it returns Latin digits when
// the language is English, so the card does not need to know which it is in.
import { toBanglaDigits } from "@/lib/format-wait";
import { customerAiDict } from "../lib/i18n";
import { useProposal } from "../hooks/use-proposal";

/**
 * The confirmation card — the execution gate, rendered.
 *
 * ---------------------------------------------------------------------------
 * What this component is responsible for
 * ---------------------------------------------------------------------------
 * Making sure the customer knows exactly what they are agreeing to, and knows
 * that they have not yet agreed to it.
 *
 * The second half is the one with teeth. The assistant's sentence above this
 * card is model-generated text, and however firmly the prompt forbids it, the
 * one failure mode that really hurts is a message that reads like a
 * confirmation when nothing has been booked. So the card says
 * "এখনো লাইনে ঢোকানো হয়নি" in its own voice, on the surface with the button,
 * where it cannot be paraphrased away.
 *
 * ---------------------------------------------------------------------------
 * Every figure here came from the database
 * ---------------------------------------------------------------------------
 * Shop name, service names, prices and the wait are read from the stored
 * `ai_actions` row, which the agent route wrote from `services.rate` and
 * `queue_public`. The model chose WHICH shop and services from what it had been
 * offered; it supplied none of these values. A missing price renders as
 * "দাম দেওয়া নেই" rather than as a guess, and a total is shown only when every
 * part of it is real (`draftTotal`).
 *
 * ---------------------------------------------------------------------------
 * One click, once
 * ---------------------------------------------------------------------------
 * The confirm button is disabled while a confirmation is in flight, so a
 * double-tap cannot send two requests. That is a courtesy rather than the
 * guarantee: `ai_action_claim()` moves the row PROPOSED → CONFIRMED in a single
 * conditional UPDATE, so even four simultaneous requests produce one booking —
 * proven with parallel clients in `run-sprint-ai3-checks.sh` (J1–J3).
 */
export function AiProposalCard({ actionId }: { actionId: string }) {
  const t = useT(customerAiDict);
  // One ticking clock for both the countdown and the expiry check, from the
  // app's own helper. The first version of this called `Date.now()` while
  // deriving state and ran its own `setInterval` inside an effect — two
  // separate React Compiler violations (`react-hooks/purity` and
  // `react-hooks/set-state-in-effect`), and both were right to complain: a
  // clock read during render makes the derived stage unstable.
  const nowMs = useNowMs(1000);
  const { stage, proposal, result, failure, confirm, cancel, busy } = useProposal(
    actionId,
    nowMs,
  );

  const draft = proposal?.display ?? null;
  const secondsLeft =
    stage === "PROPOSED" && proposal
      ? Math.max(0, Math.ceil((new Date(proposal.expiresAt).getTime() - nowMs) / 1000))
      : null;

  if (stage === "LOADING") {
    return (
      <Card tone="soft" className="flex items-center gap-2 p-4 text-sm text-muted">
        <Spinner /> {t("loadingProposal")}
      </Card>
    );
  }

  // No row, or somebody else's — RLS returns nothing either way, and the card
  // does not distinguish them. Rendering nothing is right: there is no action
  // to offer and no failure the customer caused.
  if (stage === "GONE") return null;

  if (stage === "SUCCESS") {
    const serial = result?.serial;
    return (
      <Card tone="good" className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="good">{t("successTitle")}</Badge>
        </div>
        <p className="text-sm text-ink">{t("successAt", draft?.shopName ?? "")}</p>
        {/* The position is a COLUMN on the row the trigger wrote — never a
            number this UI or the model worked out. Hidden when absent rather
            than filled in with a plausible one. */}
        {typeof serial?.position === "number" && (
          <p className="text-sm text-muted">
            {t("positionLabel")}: <span className="font-bold text-ink">{toBanglaDigits(serial.position)}</span>
          </p>
        )}
        <Link href="/my-serial" className="inline-block">
          <Button size="sm">{t("seeSerial")}</Button>
        </Link>
      </Card>
    );
  }

  if (stage === "CANCELLED") {
    return (
      <Card tone="plain" className="space-y-1 p-4">
        <p className="text-sm font-semibold text-ink">{t("cancelledTitle")}</p>
        <p className="text-sm text-muted">{t("cancelledBody")}</p>
      </Card>
    );
  }

  if (stage === "EXPIRED") {
    return (
      <Card tone="plain" className="space-y-1 p-4">
        <p className="text-sm font-semibold text-ink">{t("expiredTitle")}</p>
        <p className="text-sm text-muted">{t("expiredBody")}</p>
      </Card>
    );
  }

  if (stage === "FAILED") {
    return (
      <Card tone="plain" className="space-y-2 p-4">
        <p className="text-sm font-semibold text-ink">{t("failedTitle")}</p>
        {/* The server's own sentence when it sent one — it is more specific
            than anything this component could say, and it comes from
            `translateDbError`, the same vocabulary the booking screen uses. */}
        <p className="text-sm text-muted">{failure?.message || t("failedBody")}</p>
      </Card>
    );
  }

  // PROPOSED or EXECUTING — the card with the gate on it.
  if (!draft) return null;

  return (
    <Card tone="accent" className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-bold text-ink">{t("proposalTitle")}</p>
        {secondsLeft !== null && secondsLeft <= 60 && (
          <span className="shrink-0 text-[11px] text-muted">
            {t("expiresIn", toBanglaDigits(secondsLeft))}
          </span>
        )}
      </div>

      <dl className="space-y-1.5 text-sm">
        <Row label={t("shopLabel")} value={draft.shopName} />
        <Row
          label={t("serviceLabel")}
          value={draft.services.map((service) => service.name).join(", ")}
        />
        <Row
          label={t("priceLabel")}
          value={
            draft.totalTaka === null ? t("priceUnavailable") : t("taka", toBanglaDigits(draft.totalTaka))
          }
        />
        <Row
          label={t("waitLabel")}
          value={
            // Three genuinely different answers, and the card keeps them
            // apart. null means "people are waiting but no estimate has been
            // computed", which is not the same as no wait.
            draft.estimatedWaitMin === null
              ? t("waitUnknown")
              : draft.estimatedWaitMin === 0
                ? t("noWait")
                : t("minutes", toBanglaDigits(draft.estimatedWaitMin))
          }
        />
        {draft.waitingCount > 0 && (
          <Row label={t("aheadLabel")} value={t("people", toBanglaDigits(draft.waitingCount))} />
        )}
      </dl>

      {/* The card's own voice, not the model's. */}
      <p className="rounded-xl bg-soft/70 px-3 py-2 text-[12px] leading-snug text-muted">
        {t("notYetJoined")}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => confirm()}
          loading={stage === "EXECUTING"}
          // Disabled while anything is in flight: a second click must not send
          // a second request. The server refuses one anyway; this stops the
          // customer seeing two outcomes race.
          disabled={busy}
          className="sm:flex-1"
        >
          {stage === "EXECUTING" ? t("executing") : t("confirmCta")}
        </Button>
        <Button variant="ghost" onClick={() => cancel()} disabled={busy} className="sm:w-auto">
          {t("cancelCta")}
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-ink">{value}</dd>
    </div>
  );
}
