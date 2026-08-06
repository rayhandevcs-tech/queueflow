"use client";

import { Minus, Plus, Users, X } from "lucide-react";
import type { Service } from "@/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";

/** Matches the DB's party cap (create_group_booking / serial_before_insert). */
export const MAX_PARTY = 5;

/** One extra person the booker is bringing. Person 1 is the booker themselves. */
export interface PartyGuest {
  name: string;
  serviceIds: string[];
}

interface Props {
  services: Service[] | undefined;
  /** The booker's own selection — the default a new guest starts from. */
  ownServiceIds: string[];
  guests: PartyGuest[];
  onGuestsChange: (guests: PartyGuest[]) => void;
}

/**
 * "কয়জনের জন্য?" — the thing the app couldn't do until now.
 *
 * A father bringing two sons is the most ordinary scene in a barbershop, and
 * the one-active-serial rule made it impossible; the only way through was to
 * turn up and ask the owner to type them in by hand, which is exactly the
 * errand this app exists to remove.
 *
 * Each guest gets their own services rather than inheriting the booker's,
 * because they usually differ — the father wants a shave too, the boys don't.
 * They start pre-filled from the booker's selection so the common case is
 * still one tap.
 */
export function PartySection({ services, ownServiceIds, guests, onGuestsChange }: Props) {
  const t = useT(customerBookingDict);

  const partySize = guests.length + 1;

  const addGuest = () => {
    if (partySize >= MAX_PARTY) return;
    onGuestsChange([...guests, { name: "", serviceIds: [...ownServiceIds] }]);
  };

  const removeGuest = (index: number) => {
    onGuestsChange(guests.filter((_, i) => i !== index));
  };

  const patchGuest = (index: number, patch: Partial<PartyGuest>) => {
    onGuestsChange(guests.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const toggleGuestService = (index: number, serviceId: string) => {
    const current = guests[index].serviceIds;
    patchGuest(index, {
      serviceIds: current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-soft p-3.5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Users className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">{t("partyTitle")}</p>
          <p className="text-[11px] text-muted">{t("partyHint")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={t("partyRemoveAria")}
            disabled={guests.length === 0}
            onClick={() => removeGuest(guests.length - 1)}
            className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-ink disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-6 text-center font-number text-lg font-bold text-ink">
            {partySize}
          </span>
          <button
            type="button"
            aria-label={t("partyAddAria")}
            disabled={partySize >= MAX_PARTY}
            onClick={addGuest}
            className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-ink disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {guests.length > 0 && (
        <div className="mt-3.5 space-y-2.5 border-t border-line pt-3.5">
          {guests.map((guest, i) => (
            <div key={i} className="rounded-[14px] border border-line bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-soft font-number text-[11px] font-bold text-muted">
                  {i + 2}
                </span>
                <Input
                  value={guest.name}
                  onChange={(e) => patchGuest(i, { name: e.target.value })}
                  placeholder={t("partyGuestNamePlaceholder", i + 2)}
                  className="flex-1"
                />
                <button
                  type="button"
                  aria-label={t("partyRemoveAria")}
                  onClick={() => removeGuest(i)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:text-live"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(services ?? []).map((s) => {
                  const on = guest.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleGuestService(i, s.id)}
                      className={cn(
                        "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                        on
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line bg-card text-muted",
                      )}
                    >
                      {s.name} · ৳{s.rate}
                    </button>
                  );
                })}
              </div>

              {guest.serviceIds.length === 0 && (
                <p className="mt-1.5 text-[11px] text-live">{t("partyGuestNeedsService")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
