"use client";

import { useState } from "react";
import { Check, Scissors } from "lucide-react";
import type { Service } from "@/types";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import { providerCatalogDict } from "../lib/i18n";
import {
  useServiceStyles,
  useStyleCatalogue,
  useSetServiceStyles,
} from "../hooks/use-service-styles";

/**
 * Which styles this shop does, per service.
 *
 * Sits on the services page next to `CanPerformMatrix` and works the same way
 * on purpose: the owner already knows that screen as "the place where I say
 * what applies to what", and a second mental model for the same shape of
 * question would be a worse answer than a familiar one.
 *
 * Saving is per service and immediate — one service's list is one decision,
 * and a page-wide Save button would make the owner wonder whether the toggle
 * they just flipped had taken. Order follows the order they were picked in,
 * which is what the customer then sees.
 *
 * Salon-only for now, decided by the caller: the brief asked for the queue
 * flow and nothing else, and a parlour's appointment sheet has no style step
 * to feed. Nothing in the schema stops that changing later.
 */
export function ServiceStylesManager({
  shopId,
  services,
}: {
  shopId: string;
  services: Service[] | undefined;
}) {
  const t = useT(providerCatalogDict);
  const { language } = useLanguage();
  const showToast = useToast();

  const { data: catalogue, isPending: cataloguePending } = useStyleCatalogue();
  const { data: rows, isPending: rowsPending } = useServiceStyles(shopId);
  const save = useSetServiceStyles(shopId);

  // Which service's list is open. Collapsed by default: a shop with eight
  // services and a catalogue of twenty styles would otherwise open as a wall
  // of a hundred and sixty chips.
  const [openId, setOpenId] = useState<string | null>(null);

  const chosenByService = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const list = chosenByService.get(row.service_id) ?? [];
    list.push(row.hairstyle_id);
    chosenByService.set(row.service_id, list);
  }

  function toggle(serviceId: string, hairstyleId: string) {
    const current = chosenByService.get(serviceId) ?? [];
    const next = current.includes(hairstyleId)
      ? current.filter((id) => id !== hairstyleId)
      : [...current, hairstyleId];

    save.mutate(
      { serviceId, hairstyleIds: next },
      { onSuccess: () => showToast(t("stylesSaved")) },
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Scissors className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[17px] leading-tight font-bold text-ink">
            {t("stylesHeading")}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t("stylesDesc")}</p>
        </div>
      </div>

      {cataloguePending || rowsPending ? (
        <div className="grid min-h-24 place-items-center">
          <Spinner className="size-5 text-muted" />
        </div>
      ) : !services?.length ? (
        <p className="mt-4 rounded-2xl bg-soft px-4 py-3 text-[13px] text-muted">
          {t("stylesNoServices")}
        </p>
      ) : !catalogue?.length ? (
        <p className="mt-4 rounded-2xl bg-soft px-4 py-3 text-[13px] text-muted">
          {t("stylesEmptyCatalogue")}
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {services.map((service) => {
              const chosen = chosenByService.get(service.id) ?? [];
              const open = openId === service.id;
              return (
                <li key={service.id} className="overflow-hidden rounded-2xl border border-line">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : service.id)}
                    aria-expanded={open}
                    className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-soft"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
                      {service.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        chosen.length > 0 ? "bg-accent/10 text-accent" : "bg-soft text-muted",
                      )}
                    >
                      {chosen.length > 0
                        ? t("stylesChosenCount", String(chosen.length))
                        : t("stylesNoneChosen")}
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-line bg-soft/40 p-3">
                      <div className="flex flex-wrap gap-2">
                        {catalogue.map((style) => {
                          const on = chosen.includes(style.id);
                          const label = language === "bn" ? style.name_bn : style.name_en;
                          return (
                            <button
                              key={style.id}
                              type="button"
                              disabled={save.isPending}
                              aria-pressed={on}
                              onClick={() => toggle(service.id, style.id)}
                              className={cn(
                                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors disabled:opacity-60",
                                on
                                  ? "border-accent bg-accent text-accent-ink"
                                  : "border-line bg-card text-ink hover:border-accent/40",
                              )}
                            >
                              {on && <Check className="size-3.5" strokeWidth={3} />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] leading-snug text-muted">{t("stylesCatalogueNote")}</p>
        </>
      )}
    </Card>
  );
}
