"use client";

import { AlertTriangle, CheckCircle2, Pencil, Send, Undo2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useNowMs } from "@/hooks/use-now";
import { useT } from "@/lib/i18n";
import { toBanglaDigits } from "@/lib/format-wait";
import { CAMPAIGN_BODY_MAX, CAMPAIGN_TITLE_MAX } from "@/lib/campaign-content";
import type { CampaignDraft } from "@/lib/ai/proposals";
import { providerCampaignDict } from "../lib/campaign-i18n";
import {
  useCampaignProposal,
  type EditProblem,
} from "../hooks/use-campaign-proposal";

/**
 * The campaign approval card — the only place a campaign can be sent from.
 *
 * ---------------------------------------------------------------------------
 * What this component is for
 * ---------------------------------------------------------------------------
 * The brief's core principle ends "OWNER EXPLICITLY APPROVES", and this card is
 * where that happens. It is the one screen in the product where pressing a
 * button puts a notification on other people's phones, so it is built to be
 * read rather than dismissed:
 *
 *   · the audience, the reason and the count come FIRST, above the message. The
 *     first question is "who is this going to", not "what does it say";
 *   · `notYetSent` sits on the card the entire time it is open. §20: never show
 *     "Sent" before the broadcast has actually succeeded, and never let an
 *     owner wonder whether looking at it did something;
 *   · the count is the server's. §12 — the model's figure is not displayed
 *     anywhere, because the card reads `display.recipientCount`, which the
 *     prepare tool set from the length of the array the DATABASE returned;
 *   · the muted count is shown rather than hidden. "43 in this group, 3 have
 *     switched promotions off" is the honest sentence; quietly sending to 40
 *     and calling it 43 is not.
 *
 * ---------------------------------------------------------------------------
 * The edit, and what it cannot touch
 * ---------------------------------------------------------------------------
 * §13 requires that the owner be able to rewrite the message. So there are two
 * text fields, and nothing else on this card is editable: no audience picker,
 * no segment dropdown, no recipient list, no count. That is not restraint in
 * the UI, it is the shape of the request — `/api/ai/actions/confirm` accepts a
 * title and a body and has no field for anything else, and
 * `ai_action_apply_campaign_edit()` has two parameters.
 *
 * The edited text is what goes out, and it is written to the audit row before
 * the send so that the message in the record is the message that was
 * delivered.
 *
 * ---------------------------------------------------------------------------
 * One click, once
 * ---------------------------------------------------------------------------
 * Every button is disabled while a send is in flight, so a double-tap cannot
 * post twice. That is a courtesy rather than the guarantee: `ai_action_claim()`
 * moves the row PROPOSED → CONFIRMED in a single conditional UPDATE, and
 * `notifications_one_per_campaign_recipient_idx` makes a duplicate insert
 * impossible underneath it — five simultaneous approvals produce one send,
 * proven with parallel clients in section J of `run-sprint-ai5-checks.sh`.
 */
export function AiCampaignProposalCard({ actionId }: { actionId: string }) {
  const t = useT(providerCampaignDict);
  // One ticking clock for both the countdown and the expiry check, from the
  // app's own helper — `Date.now()` during render is a React Compiler purity
  // violation, and it would make the derived stage unstable besides.
  const nowMs = useNowMs(1000);
  const {
    stage,
    proposal,
    draft,
    content,
    edited,
    editing,
    editProblem,
    setEdit,
    startEditing,
    stopEditing,
    revertEdit,
    result,
    failure,
    approve,
    cancel,
    busy,
  } = useCampaignProposal(actionId, nowMs);

  const secondsLeft =
    stage === "PROPOSED" && proposal
      ? Math.max(0, Math.ceil((new Date(proposal.expiresAt).getTime() - nowMs) / 1000))
      : null;

  if (stage === "LOADING") {
    return (
      <Card tone="soft" className="flex items-center gap-2 p-4 text-sm text-muted">
        <Spinner /> {t("loading")}
      </Card>
    );
  }

  // No row, somebody else's, or not a campaign — RLS returns nothing for the
  // first two and the hook refuses the third. Rendering nothing is right:
  // there is no action to offer and no failure the owner caused.
  if (stage === "GONE" || !draft) return null;

  if (stage === "SENT") return <CampaignSent t={t} draft={draft} result={result} />;

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
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 shrink-0 text-live" />
          {t("failedTitle")}
        </p>
        {/*
          The endpoint's own Bangla, from its closed refusal vocabulary — never
          a database message. BROADCAST_LIMIT_REACHED and SEGMENT_CHANGED are
          the two an owner will actually meet, and both of those sentences say
          what to do next rather than only that something went wrong.
        */}
        <p className="text-sm text-muted">{failure?.message || t("failedFallback")}</p>
      </Card>
    );
  }

  // --- PROPOSED / EXECUTING -------------------------------------------------
  const sending = stage === "EXECUTING";

  return (
    <Card tone="plain" className="space-y-3.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold text-ink">{t("title")}</p>
          <p className="mt-0.5 text-[12px] text-muted">{t("reviewHint")}</p>
        </div>
        {secondsLeft !== null && (
          <span className="shrink-0 text-[11px] text-muted">
            {t("expiresIn", toBanglaDigits(secondsLeft))}
          </span>
        )}
      </div>

      {/* Who, why, and how many — above the message, deliberately. */}
      <dl className="space-y-1.5 text-sm">
        <Row label={t("groupLabel")} value={draft.segmentLabel} />
        <Row label={t("whyLabel")} value={draft.reason} />
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-muted">{t("countLabel")}</dt>
          <dd className="flex min-w-0 items-center gap-1.5 text-right font-semibold text-ink">
            <Users className="h-3.5 w-3.5 shrink-0 text-accent" />
            {t("countValue", toBanglaDigits(draft.recipientCount))}
          </dd>
        </div>
      </dl>

      {draft.mutedCount > 0 && (
        <p className="text-[11px] leading-snug text-muted">
          {t("mutedNote", toBanglaDigits(draft.mutedCount))}
        </p>
      )}

      {/* The message. Read-only until they press Edit. */}
      {editing ? (
        <CampaignEditor
          t={t}
          content={content}
          problem={editProblem}
          disabled={busy}
          onChange={setEdit}
        />
      ) : (
        <div className="space-y-1.5 rounded-xl bg-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
              {t("messageLabel")}
            </p>
            {edited && <Badge variant="accent">{t("editedBadge")}</Badge>}
          </div>
          <p className="text-[13px] font-bold text-ink">{content?.title}</p>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
            {content?.body}
          </p>
        </div>
      )}

      {/* The card's own voice, not the model's, and it stays until the send
          actually succeeds. */}
      <p className="rounded-xl bg-live-soft/60 px-3 py-2 text-[12px] leading-snug text-ink">
        {t("notYetSent")}
      </p>
      <p className="text-[11px] text-muted">{t("dailyLimitNote")}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {editing ? (
          <>
            <Button
              className="flex-1"
              onClick={stopEditing}
              disabled={busy || !!editProblem}
            >
              {t("editDoneCta")}
            </Button>
            {edited && (
              <Button variant="ghost" className="flex-1" onClick={revertEdit} disabled={busy}>
                <Undo2 className="mr-1.5 h-4 w-4" />
                {t("editCancelCta")}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              className="flex-1"
              onClick={() => approve()}
              loading={sending}
              disabled={busy || !!editProblem}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {sending ? t("sending") : t("approveCta")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={startEditing}
              disabled={busy}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              {t("editCta")}
            </Button>
            <Button variant="ghost" onClick={() => cancel()} disabled={busy}>
              <X className="mr-1.5 h-4 w-4" />
              {t("cancelCta")}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

type T = ReturnType<typeof useT<typeof providerCampaignDict>>;

/**
 * The two text fields, and nothing else.
 *
 * Worth noting what is absent: there is no audience control here, no segment
 * picker and no recipient list. §13 lists those as things an owner may not
 * edit, and the reason this component does not have to enforce that is that
 * the request cannot carry them — `/api/ai/actions/confirm` takes a title and
 * a body, and `ai_action_apply_campaign_edit()` has two parameters.
 *
 * The character counters use the same two constants the endpoint and the SQL
 * both check, so the field stops accepting text at exactly the point the
 * server would have refused it.
 */
function CampaignEditor({
  t,
  content,
  problem,
  disabled,
  onChange,
}: {
  t: T;
  content: { title: string; body: string } | null;
  problem: EditProblem | null;
  disabled: boolean;
  onChange: (next: { title: string; body: string }) => void;
}) {
  const title = content?.title ?? "";
  const body = content?.body ?? "";

  return (
    <div className="space-y-2 rounded-xl bg-soft p-3">
      <p className="text-[11px] leading-snug text-muted">{t("editHint")}</p>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold tracking-wide text-muted uppercase">
          {t("headlineLabel")}
        </span>
        <input
          value={title}
          onChange={(e) => onChange({ title: e.target.value, body })}
          placeholder={t("titlePlaceholder")}
          maxLength={CAMPAIGN_TITLE_MAX}
          disabled={disabled}
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] font-semibold text-ink outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold tracking-wide text-muted uppercase">
          {t("messageLabel")}
        </span>
        <textarea
          value={body}
          onChange={(e) => onChange({ title, body: e.target.value })}
          placeholder={t("bodyPlaceholder")}
          maxLength={CAMPAIGN_BODY_MAX}
          rows={4}
          disabled={disabled}
          className="w-full resize-y rounded-xl border border-line bg-card px-3 py-2 text-[13px] leading-relaxed text-ink outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        <span className="mt-1 block text-right text-[10px] text-muted">
          {t("charsLeft", toBanglaDigits(CAMPAIGN_BODY_MAX - body.length))}
        </span>
      </label>

      {problem && (
        <p className="text-[11px] text-live">
          {problem === "TITLE_TOO_LONG"
            ? t("titleTooLong")
            : problem === "BODY_TOO_LONG"
              ? t("bodyTooLong")
              : t("emptyContent")}
        </p>
      )}
    </div>
  );
}

/**
 * The success state, and the one figure on it that is not the approved count.
 *
 * `sentCount` came back from `broadcast_campaign()` — the number of rows the
 * insert actually created. The approved count is on the draft. When they
 * differ, the difference is people who muted promotions between the proposal
 * and the send, and the card says so: reporting the approved figure as the
 * delivered one would be a small lie that the owner would only discover by
 * counting replies.
 *
 * Zero sent gets its own sentence. "Sent to 0 customers" reads like a failure
 * and this was not one — the send succeeded and the audience had all opted out.
 */
function CampaignSent({
  t,
  draft,
  result,
}: {
  t: T;
  draft: CampaignDraft;
  result: { campaign?: { sentCount?: number } } | null;
}) {
  const sent = result?.campaign?.sentCount;
  const approved = draft.recipientCount;

  return (
    <Card tone="plain" className="space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-good" />
        {t("sentTitle")}
      </p>

      {/*
        Only stated when the server told us. A reconciled duplicate
        confirmation can report the count alone, and a lost read reports
        nothing — in which case the card says the campaign was sent and stops,
        rather than inventing a delivery figure.
      */}
      {typeof sent === "number" && (
        <>
          {sent === 0 ? (
            <p className="text-sm text-muted">{t("sentNoneNote")}</p>
          ) : (
            <p className="text-sm text-muted">{t("sentBody", toBanglaDigits(sent))}</p>
          )}
          {sent > 0 && sent < approved && (
            <p className="text-[11px] leading-snug text-muted">
              {t("sentFewerNote", toBanglaDigits(approved), toBanglaDigits(sent))}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
