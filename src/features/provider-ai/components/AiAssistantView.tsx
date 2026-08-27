"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Info,
  Sparkles,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useShopChat, useShopInsights, type AiErrorCode } from "../hooks/use-ai";
import { providerAiDict } from "../lib/i18n";

export function AiAssistantView() {
  const t = useT(providerAiDict);

  return (
    <div className="space-y-5">
      <PageHeader title={t("pageTitle")} description={t("pageSubtitle")} />
      <InsightsCard />
      <ChatCard />
      <p className="px-1 text-center text-[11px] text-muted">{t("aiCaveat")}</p>
    </div>
  );
}

function ErrorNote({ code }: { code: AiErrorCode }) {
  const t = useT(providerAiDict);
  const message =
    code === "NO_DATA"
      ? t("errNoData")
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

function InsightsCard() {
  const t = useT(providerAiDict);
  const insights = useShopInsights();
  const data = insights.data?.insights;

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Sparkles className="h-4.5 w-4.5 text-accent" />
          {t("pageTitle")}
        </h2>
        <Button
          size="sm"
          onClick={() => insights.mutate()}
          loading={insights.isPending}
          disabled={insights.isPending}
        >
          {data ? t("analyseAgainCta") : t("analyseCta")}
        </Button>
      </div>

      <div className="mt-3.5">
        {insights.isPending ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Spinner className="h-5 w-5 text-muted" />
            <p className="text-[13px] font-semibold text-ink">{t("analysing")}</p>
            <p className="text-[11px] text-muted">{t("analysingHint")}</p>
          </div>
        ) : insights.error ? (
          <ErrorNote code={insights.error.code} />
        ) : !data ? (
          <div className="rounded-xl bg-soft p-4">
            <p className="text-[13px] font-semibold text-ink">{t("idleTitle")}</p>
            <p className="mt-0.5 text-[11px] text-muted">{t("idleBody")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-display text-[17px] leading-snug font-bold text-ink">
              {data.headline}
            </p>

            {data.dataNote && (
              <p className="flex items-start gap-2 rounded-xl bg-brass-soft p-3 text-[12px] text-brass">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{data.dataNote}</span>
              </p>
            )}

            <ul className="space-y-2.5">
              {data.findings.map((f, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-xl border-l-3 bg-soft p-3",
                    f.tone === "good"
                      ? "border-good"
                      : f.tone === "warning"
                        ? "border-live"
                        : "border-line",
                  )}
                >
                  <p className="text-[13px] font-bold text-ink">{f.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{f.detail}</p>
                </li>
              ))}
            </ul>

            {data.actions.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t("actionsTitle")}
                </h3>
                <ul className="space-y-2">
                  {data.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-ink">
                          {a.action}
                        </span>
                        <span className="block text-[11px] text-muted">{a.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.data && (
              <p className="text-[11px] text-muted">
                {t("generatedAt", formatBanglaDate(new Date(insights.data.generatedAt)))}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ChatCard() {
  const t = useT(providerAiDict);
  const { turns, streaming, error, send, stop } = useShopChat();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns]);

  const suggestions = [
    t("suggestion1"),
    t("suggestion2"),
    t("suggestion3"),
    t("suggestion4"),
  ];

  const submit = (text: string) => {
    setDraft("");
    void send(text);
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-base font-bold text-ink">{t("chatTitle")}</h2>

      {turns.length === 0 ? (
        <div className="mt-3">
          <p className="text-[12px] text-muted">{t("chatEmpty")}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border border-line bg-soft px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/50 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 max-h-[26rem] space-y-2.5 overflow-y-auto">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                turn.role === "user"
                  ? "ml-auto bg-accent text-accent-ink"
                  : "bg-soft text-ink",
              )}
            >
              {turn.content || <TypingDots />}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote code={error} />
        </div>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chatPlaceholder")}
          maxLength={2000}
          className="min-w-0 flex-1 rounded-xl border border-line bg-soft px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            aria-label={t("chatSend")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted transition-colors hover:text-ink"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label={t("chatSend")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="h-4.5 w-4.5" />
          </button>
        )}
      </form>
    </section>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
