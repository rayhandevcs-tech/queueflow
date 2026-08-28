"use client";

import { useEffect } from "react";
import { AlertTriangle, Check, Mic } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useDictation } from "../hooks/use-dictation";
import {
  useRunVoiceIntent,
  useVoiceIntent,
  useVoiceStage,
} from "../hooks/use-voice-command";
import { providerVoiceDict } from "../lib/i18n";

/**
 * Speak a command instead of typing one.
 *
 * Built for the actual situation: a shopkeeper with scissors in one hand and a
 * customer in the chair, on a phone, in Bangla. Typing a walk-in takes half a
 * minute of tapping through a form; saying it takes three seconds.
 *
 * Nothing runs without confirmation, and that is the whole design. Browser
 * dictation mishears names and numbers routinely, so the sheet shows what was
 * understood — the amount, the service by name — and waits. A wrong entry
 * causes an argument at the counter; re-saying a sentence costs five seconds.
 */
export function VoiceCommandButton({ shopId }: { shopId: string | undefined }) {
  const t = useT(providerVoiceDict);
  const showToast = useToast();
  const dictation = useDictation();
  const understand = useVoiceIntent();
  const run = useRunVoiceIntent(shopId);
  const { stage, setStage, intent, setIntent, reset } = useVoiceStage();

  // When dictation stops on its own — a long pause, or the engine giving up —
  // send whatever was captured rather than leaving the sheet waiting.
  useEffect(() => {
    if (stage !== "listening" || dictation.listening) return;
    const text = dictation.transcript.trim();
    if (!text) return;

    setStage("thinking");
    understand.mutate(text, {
      onSuccess: (result) => {
        setIntent(result);
        setStage("confirm");
      },
      onError: () => setStage("confirm"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate identity is stable
  }, [dictation.listening, dictation.transcript, stage]);

  const open = stage !== "idle";

  const close = () => {
    dictation.reset();
    understand.clearError();
    understand.reset();
    reset();
  };

  const startListening = () => {
    understand.clearError();
    understand.reset();
    setIntent(null);
    setStage("listening");
    dictation.start();
  };

  const confirm = () => {
    if (!intent) return;
    setStage("running");
    run.mutate(intent, {
      onSuccess: () => {
        showToast(doneMessage(intent.intent, intent.shopOpen?.open, t));
        close();
      },
      onError: () => setStage("confirm"),
    });
  };

  if (!dictation.supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={startListening}
        aria-label={t("micLabel")}
        className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent/50"
      >
        <Mic className="h-4 w-4 text-accent" />
        {t("micLabel")}
      </button>

      {open && (
        <BottomSheet open onClose={close} maxWidthClassName="max-w-md">
          {stage === "listening" && (
            <div className="space-y-3.5 text-center">
              {/* The pulsing ring is the only signal that the microphone is
                  live — without it people talk into a screen that looks idle. */}
              <span className="relative mx-auto grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 rounded-full bg-accent/25 motion-safe:animate-ping" />
                <span className="relative grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink">
                  <Mic className="h-6 w-6" />
                </span>
              </span>

              <div>
                <p className="font-display text-base font-bold text-ink">
                  {t("listeningTitle")}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">{t("listeningHint")}</p>
              </div>

              {dictation.transcript ? (
                <p className="rounded-xl bg-soft p-3 text-[14px] leading-relaxed text-ink">
                  {dictation.transcript}
                </p>
              ) : (
                <Examples />
              )}

              {dictation.error && <DictationError code={dictation.error} />}

              {/* Primary, not outline: this is the one thing to do here once
                  you have said your sentence, and an outline button next to a
                  live microphone reads as "cancel". */}
              <Button className="w-full" onClick={() => dictation.stop()}>
                <Check className="mr-1.5 h-4 w-4" />
                {t("stopCta")}
              </Button>
            </div>
          )}

          {stage === "thinking" && (
            <div className="flex flex-col items-center gap-2 py-8">
              <Spinner className="h-5 w-5 text-muted" />
              <p className="text-[13px] font-semibold text-ink">{t("thinking")}</p>
            </div>
          )}

          {(stage === "confirm" || stage === "running") && (
            <div className="space-y-3.5">
              <div>
                <p className="text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t("heardLabel")}
                </p>
                <p className="mt-0.5 text-[13px] text-muted italic">
                  “{dictation.transcript}”
                </p>
              </div>

              {understand.errorCode ? (
                <IntentError code={understand.errorCode} />
              ) : intent?.intent === "unknown" ? (
                <p className="flex items-start gap-2 rounded-xl bg-brass-soft p-3 text-[13px] text-brass">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{intent.reason || t("errGeneric")}</span>
                </p>
              ) : intent ? (
                <>
                  <p className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3.5 font-display text-[15px] leading-snug font-bold text-ink">
                    {intent.summary}
                  </p>
                  {run.isError && (
                    <p className="text-[12px] text-live">{t("errGeneric")}</p>
                  )}
                  <Button
                    className="w-full"
                    loading={stage === "running"}
                    onClick={confirm}
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    {t("confirmCta")}
                  </Button>
                </>
              ) : null}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={startListening}>
                  {t("retryCta")}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={close}>
                  {t("cancelCta")}
                </Button>
              </div>

              <p className="text-center text-[11px] text-muted">{t("caveat")}</p>
            </div>
          )}
        </BottomSheet>
      )}
    </>
  );
}

function Examples() {
  const t = useT(providerVoiceDict);
  return (
    <div className="rounded-xl bg-soft p-3 text-left">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {t("examplesTitle")}
      </p>
      <ul className="mt-1.5 space-y-1">
        {[t("example1"), t("example2"), t("example3")].map((e) => (
          <li key={e} className="text-[12px] text-ink">
            “{e}”
          </li>
        ))}
      </ul>
    </div>
  );
}

function DictationError({ code }: { code: "denied" | "no-speech" | "unsupported" | "failed" }) {
  const t = useT(providerVoiceDict);
  const message =
    code === "denied"
      ? t("errDenied")
      : code === "no-speech"
        ? t("errNoSpeech")
        : code === "unsupported"
          ? t("errUnsupported")
          : t("errFailed");

  return <p className="rounded-xl bg-live-soft p-3 text-[12px] text-live">{message}</p>;
}

function IntentError({ code }: { code: "NO_SERVICES" | "ANTHROPIC_KEY_MISSING" | "GENERIC" }) {
  const t = useT(providerVoiceDict);
  const message =
    code === "NO_SERVICES"
      ? t("errNoServices")
      : code === "ANTHROPIC_KEY_MISSING"
        ? t("errNoKey")
        : t("errGeneric");

  return (
    <p className="flex items-start gap-2 rounded-xl bg-live-soft p-3 text-[13px] text-live">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function doneMessage(
  intent: string,
  opened: boolean | undefined,
  t: (key: "doneWalkIn" | "doneExpense" | "doneIncome" | "doneShopOpen" | "doneShopClosed") => string,
): string {
  if (intent === "add_walk_in") return t("doneWalkIn");
  if (intent === "add_expense") return t("doneExpense");
  if (intent === "add_manual_income") return t("doneIncome");
  return opened ? t("doneShopOpen") : t("doneShopClosed");
}
