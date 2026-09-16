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
import {
  AI_ACTION_BOOK_APPOINTMENT,
  AI_ACTION_REDEEM_REWARD,
  type AppointmentDraft,
  type JoinQueueDraft,
  type RewardDraft,
} from "@/lib/ai/proposals";
import { customerAiDict } from "../lib/i18n";
import { useProposal } from "../hooks/use-proposal";
import type { ConfirmSuccess } from "../api/proposals.api";

/**
 * The confirmation card — the execution gate, rendered, for all three actions.
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
 * confirmation when nothing has been done. So the card says so in its own
 * voice, on the surface with the button, where it cannot be paraphrased away —
 * and it names the specific thing that has not happened, because "nothing has
 * been done" is vague enough to be read as reassurance.
 *
 * ---------------------------------------------------------------------------
 * Three actions, one gate
 * ---------------------------------------------------------------------------
 * The rendering branches on `display.action`, the same discriminant the confirm
 * endpoint switches on. What does NOT branch is the gate itself: one confirm
 * button, disabled while anything is in flight, one cancel, one countdown, one
 * set of outcome states. Duplicating the gate per action is how one of the
 * three ends up missing the disabled state.
 *
 * ---------------------------------------------------------------------------
 * Every figure here came from the database
 * ---------------------------------------------------------------------------
 * Shop and staff names, service names, prices, durations, the wait, the points
 * cost and the balance are all read from the stored `ai_actions` row, which the
 * agent route wrote from `services.rate`, `services.default_duration_min`,
 * `queue_public`, `shop_available_slots()`, `rewards` and `loyalty_accounts`.
 * The model chose WHICH shop, services, slot and reward from what it had been
 * offered; it supplied none of these values. A missing price renders as
 * "দাম দেওয়া নেই" rather than as a guess, and a total is shown only when every
 * part of it is real (`draftTotal`).
 *
 * On success the figures come from the row that was just created — the serial's
 * `position`, the appointment's `ends_at` and `total_amount`, the coupon's own
 * code and the balance the RPC returned. Anything the server did not send is
 * hidden rather than reconstructed.
 *
 * ---------------------------------------------------------------------------
 * One click, once
 * ---------------------------------------------------------------------------
 * The confirm button is disabled while a confirmation is in flight, so a
 * double-tap cannot send two requests. That is a courtesy rather than the
 * guarantee: `ai_action_claim()` moves the row PROPOSED → CONFIRMED in a single
 * conditional UPDATE, so even four simultaneous requests produce one action —
 * proven with parallel clients in the Sprint 3 and Sprint 4 harnesses.
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
  const kind = draft?.action;
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
    if (kind === AI_ACTION_BOOK_APPOINTMENT) {
      return <AppointmentSuccess t={t} result={result} draft={draft} />;
    }
    if (kind === AI_ACTION_REDEEM_REWARD) {
      return <RewardSuccess t={t} result={result} draft={draft} />;
    }
    return <QueueSuccess t={t} result={result} draft={draft} />;
  }

  if (stage === "CANCELLED") {
    return (
      <Card tone="plain" className="space-y-1 p-4">
        <p className="text-sm font-semibold text-ink">{t("cancelledTitle")}</p>
        <p className="text-sm text-muted">
          {kind === AI_ACTION_BOOK_APPOINTMENT
            ? t("apptCancelledBody")
            : kind === AI_ACTION_REDEEM_REWARD
              ? t("rewardCancelledBody")
              : t("cancelledBody")}
        </p>
      </Card>
    );
  }

  if (stage === "EXPIRED") {
    return (
      <Card tone="plain" className="space-y-1 p-4">
        <p className="text-sm font-semibold text-ink">{t("expiredTitle")}</p>
        <p className="text-sm text-muted">
          {kind === AI_ACTION_BOOK_APPOINTMENT
            ? t("apptExpiredBody")
            : kind === AI_ACTION_REDEEM_REWARD
              ? t("rewardExpiredBody")
              : t("expiredBody")}
        </p>
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
        <p className="text-sm text-muted">
          {failure?.message ||
            (kind === AI_ACTION_BOOK_APPOINTMENT
              ? t("apptFailedBody")
              : kind === AI_ACTION_REDEEM_REWARD
                ? t("rewardFailedBody")
                : t("failedBody"))}
        </p>
      </Card>
    );
  }

  // PROPOSED or EXECUTING — the card with the gate on it.
  if (!draft) return null;

  const executing = stage === "EXECUTING";

  return (
    <Card tone="accent" className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-bold text-ink">
          {kind === AI_ACTION_BOOK_APPOINTMENT
            ? t("apptTitle")
            : kind === AI_ACTION_REDEEM_REWARD
              ? t("rewardTitle")
              : t("proposalTitle")}
        </p>
        {secondsLeft !== null && secondsLeft <= 60 && (
          <span className="shrink-0 text-[11px] text-muted">
            {t("expiresIn", toBanglaDigits(secondsLeft))}
          </span>
        )}
      </div>

      <dl className="space-y-1.5 text-sm">
        {draft.action === AI_ACTION_BOOK_APPOINTMENT ? (
          <AppointmentRows t={t} draft={draft} />
        ) : draft.action === AI_ACTION_REDEEM_REWARD ? (
          <RewardRows t={t} draft={draft} />
        ) : (
          <QueueRows t={t} draft={draft} />
        )}
      </dl>

      {/* The card's own voice, not the model's. */}
      <p className="rounded-xl bg-soft/70 px-3 py-2 text-[12px] leading-snug text-muted">
        {kind === AI_ACTION_BOOK_APPOINTMENT
          ? t("apptNotYetBooked")
          : kind === AI_ACTION_REDEEM_REWARD
            ? t("rewardNotYetSpent")
            : t("notYetJoined")}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => confirm()}
          loading={executing}
          // Disabled while anything is in flight: a second click must not send
          // a second request. The server refuses one anyway; this stops the
          // customer seeing two outcomes race.
          disabled={busy}
          className="sm:flex-1"
        >
          {kind === AI_ACTION_BOOK_APPOINTMENT
            ? executing
              ? t("apptExecuting")
              : t("apptConfirmCta")
            : kind === AI_ACTION_REDEEM_REWARD
              ? executing
                ? t("rewardExecuting")
                : t("rewardConfirmCta")
              : executing
                ? t("executing")
                : t("confirmCta")}
        </Button>
        <Button variant="ghost" onClick={() => cancel()} disabled={busy} className="sm:w-auto">
          {t("cancelCta")}
        </Button>
      </div>
    </Card>
  );
}

/** `useT`'s return, so the row components can be plain functions. */
type T = ReturnType<typeof useT<typeof customerAiDict>>;

// ---------------------------------------------------------------------------
// The rows, per action
// ---------------------------------------------------------------------------

function QueueRows({ t, draft }: { t: T; draft: JoinQueueDraft }) {
  return (
    <>
      <Row label={t("shopLabel")} value={draft.shopName} />
      <Row
        label={t("serviceLabel")}
        value={draft.services.map((service) => service.name).join(", ")}
      />
      <Row
        label={t("priceLabel")}
        value={
          draft.totalTaka === null
            ? t("priceUnavailable")
            : t("taka", toBanglaDigits(draft.totalTaka))
        }
      />
      <Row
        label={t("waitLabel")}
        value={
          // Three genuinely different answers, and the card keeps them apart.
          // null means "people are waiting but no estimate has been computed",
          // which is not the same as no wait.
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
    </>
  );
}

function AppointmentRows({ t, draft }: { t: T; draft: AppointmentDraft }) {
  return (
    <>
      <Row label={t("shopLabel")} value={draft.shopName} />
      <Row
        label={t("serviceLabel")}
        value={draft.services.map((service) => service.name).join(", ")}
      />
      <Row label={t("dateLabel")} value={formatDhakaDate(draft.startsAt)} />
      {/* The span, not just the start: the customer is agreeing to a length of
          time, and `endsAt` is the same arithmetic the insert trigger uses. */}
      <Row
        label={t("timeLabel")}
        value={`${formatDhakaTime(draft.startsAt)} – ${formatDhakaTime(draft.endsAt)}`}
      />
      <Row label={t("durationLabel")} value={t("minutes", toBanglaDigits(draft.durationMin))} />
      {/* Shown whenever the shop named the person. It is not optional to the
          customer: "with whom" is half of what an appointment is. */}
      {draft.staffName && <Row label={t("staffLabel")} value={draft.staffName} />}
      <Row
        label={t("priceLabel")}
        value={
          draft.totalTaka === null
            ? t("priceUnavailable")
            : t("taka", toBanglaDigits(draft.totalTaka))
        }
      />
    </>
  );
}

function RewardRows({ t, draft }: { t: T; draft: RewardDraft }) {
  return (
    <>
      <Row label={t("shopLabel")} value={draft.shopName} />
      <Row label={t("rewardLabel")} value={draft.rewardName} />
      <Row label={t("benefitLabel")} value={benefitOf(t, draft)} />
      <Row label={t("pointsCostLabel")} value={t("points", toBanglaDigits(draft.pointsCost))} />
      {/* Labelled "at this shop" in both languages, because that is the whole
          truth about a QueueFlow balance and a card that implied otherwise
          would be promising points the shop's own account cannot pay. */}
      <Row label={t("balanceLabel")} value={t("points", toBanglaDigits(draft.balance))} />
      <Row
        label={t("balanceAfterLabel")}
        value={t("points", toBanglaDigits(draft.balanceAfter))}
      />
      {draft.validUntil && (
        <Row label={t("validUntilLabel")} value={formatDhakaDate(draft.validUntil)} />
      )}
    </>
  );
}

/**
 * What the reward actually gives, described from `kind` and `value`.
 *
 * Never a taka figure for a percentage. At redemption time there is no bill to
 * apply it to — the coupon is spent later, at the counter — so "10% off" is the
 * only honest rendering, and computing "about ৳120" from a bill that does not
 * exist yet would be exactly the sort of invented number this whole feature is
 * built to avoid.
 */
function benefitOf(t: T, draft: RewardDraft): string {
  if (draft.rewardKind === "DISCOUNT_FLAT" && draft.rewardValue !== null) {
    return t("benefitFlat", toBanglaDigits(draft.rewardValue));
  }
  if (draft.rewardKind === "DISCOUNT_PCT" && draft.rewardValue !== null) {
    return t("benefitPct", toBanglaDigits(draft.rewardValue));
  }
  if (draft.rewardKind === "FREE_SERVICE" && draft.freeServiceName) {
    return t("benefitFreeService", draft.freeServiceName);
  }
  // A kind we cannot describe falls back to the reward's own name and its
  // description, both of which the shop wrote. Not a guess at the benefit.
  return draft.rewardDescription || draft.rewardName;
}

// ---------------------------------------------------------------------------
// The outcomes
// ---------------------------------------------------------------------------

function QueueSuccess({
  t,
  result,
  draft,
}: {
  t: T;
  result: ConfirmSuccess | null;
  draft: JoinQueueDraft | AppointmentDraft | RewardDraft | null;
}) {
  const serial = result?.serial;
  const shopName = draft && "shopName" in draft ? draft.shopName : "";
  return (
    <Card tone="good" className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="good">{t("successTitle")}</Badge>
      </div>
      <p className="text-sm text-ink">{t("successAt", shopName)}</p>
      {/* The position is a COLUMN on the row the trigger wrote — never a
          number this UI or the model worked out. Hidden when absent rather
          than filled in with a plausible one. */}
      {typeof serial?.position === "number" && (
        <p className="text-sm text-muted">
          {t("positionLabel")}:{" "}
          <span className="font-bold text-ink">{toBanglaDigits(serial.position)}</span>
        </p>
      )}
      <Link href="/my-serial" className="inline-block">
        <Button size="sm">{t("seeSerial")}</Button>
      </Link>
    </Card>
  );
}

function AppointmentSuccess({
  t,
  result,
  draft,
}: {
  t: T;
  result: ConfirmSuccess | null;
  draft: JoinQueueDraft | AppointmentDraft | RewardDraft | null;
}) {
  const booked = result?.appointment;
  const shopName = draft && "shopName" in draft ? draft.shopName : "";
  // From the `appointments` row wherever the server read it back; the draft is
  // the fallback for the same instant, which is the value that was proposed and
  // confirmed. Neither is computed here.
  const startsAt =
    booked?.startsAt ?? (draft?.action === AI_ACTION_BOOK_APPOINTMENT ? draft.startsAt : null);
  const endsAt =
    booked?.endsAt ?? (draft?.action === AI_ACTION_BOOK_APPOINTMENT ? draft.endsAt : null);

  return (
    <Card tone="good" className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="good">{t("apptSuccessTitle")}</Badge>
      </div>
      <p className="text-sm text-ink">{t("apptSuccessAt", shopName)}</p>
      <dl className="space-y-1 text-sm">
        {startsAt && <Row label={t("dateLabel")} value={formatDhakaDate(startsAt)} />}
        {startsAt && endsAt && (
          <Row
            label={t("timeLabel")}
            value={`${formatDhakaTime(startsAt)} – ${formatDhakaTime(endsAt)}`}
          />
        )}
        {result?.staff?.name && <Row label={t("staffLabel")} value={result.staff.name} />}
        {/* `total_amount` from the row — computed by
            `appointment_before_insert` from `services.rate`, not carried over
            from the card. */}
        {typeof booked?.totalTaka === "number" && (
          <Row label={t("priceLabel")} value={t("taka", toBanglaDigits(booked.totalTaka))} />
        )}
      </dl>
      {/* `/my-serial` is where a customer's appointments actually live — that
          page renders `MyAppointmentsList` alongside the queue serial, because
          a unisex shop does both. There is no `/my-appointments` route, and
          this card pointing at one would have been a 404 dressed up as a
          next step. */}
      <Link href="/my-serial" className="inline-block">
        <Button size="sm">{t("seeAppointments")}</Button>
      </Link>
    </Card>
  );
}

function RewardSuccess({
  t,
  result,
  draft,
}: {
  t: T;
  result: ConfirmSuccess | null;
  draft: JoinQueueDraft | AppointmentDraft | RewardDraft | null;
}) {
  const redemption = result?.redemption;
  const rewardName =
    result?.reward?.name ?? (draft?.action === AI_ACTION_REDEEM_REWARD ? draft.rewardName : "");

  return (
    <Card tone="good" className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="good">{t("rewardSuccessTitle")}</Badge>
      </div>
      {rewardName && <p className="text-sm text-ink">{rewardName}</p>}
      <dl className="space-y-1 text-sm">
        {/* The code the RPC generated. Never constructed here — a coupon code
            the shop cannot find is worse than no code at all. */}
        {redemption?.code && (
          <Row label={t("codeLabel")} value={redemption.code} mono />
        )}
        {typeof redemption?.pointsSpent === "number" && (
          <Row
            label={t("pointsSpentLabel")}
            value={t("points", toBanglaDigits(redemption.pointsSpent))}
          />
        )}
        {typeof redemption?.balanceAfter === "number" && (
          <Row
            label={t("newBalanceLabel")}
            value={t("points", toBanglaDigits(redemption.balanceAfter))}
          />
        )}
      </dl>
      {/* The thing a customer most needs to know about a coupon: redeeming it
          has not discounted anything yet. */}
      <p className="rounded-xl bg-soft/70 px-3 py-2 text-[12px] leading-snug text-muted">
        {t("couponHowTo")}
      </p>
      {/* Coupons are on the customer's profile page (`MyCouponsCard`), not on
          a `/rewards` route — that one belongs to the provider shell. */}
      <Link href="/profile" className="inline-block">
        <Button size="sm">{t("seeCoupons")}</Button>
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd
        className={`min-w-0 text-right break-words text-ink ${
          mono ? "font-mono text-base font-bold tracking-widest" : "font-medium"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Dates and times in the shop's timezone, always.
 *
 * `Intl` with an explicit `timeZone` rather than the browser's locale default:
 * a customer travelling, or a phone set to the wrong zone, must still see the
 * time the shop expects them. `public.shop_timezone()` is the database's
 * matching constant.
 */
const DHAKA = "Asia/Dhaka";

function formatDhakaDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function formatDhakaTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}
