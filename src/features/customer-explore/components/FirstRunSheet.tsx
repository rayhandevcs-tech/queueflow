"use client";

import { useEffect, useState } from "react";
import { MapPin, Navigation, Ticket } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const SEEN_KEY = "qf.seenIntro";

/**
 * Three sentences explaining the one thing about this app that isn't obvious:
 * you take a serial from where you are and turn up when it's nearly your turn.
 *
 * Device-local like the language preference, not a profile column — it's about
 * this browser having seen the explanation, and a server round trip to decide
 * whether to show a welcome message would be worse than showing it twice.
 *
 * Deliberately not a blocking tour with highlighted targets: one dismissible
 * sheet respects someone who already understands, and anyone who skips it
 * loses nothing.
 */
export function FirstRunSheet() {
  const t = useT(customerExploreDict);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(true);
      }
    } catch {
      // Private mode — skip the intro rather than showing it on every visit.
    }
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to do; worst case they see it again next time.
    }
    setOpen(false);
  };

  const STEPS = [
    { icon: <MapPin className="h-5 w-5" />, title: t("introStep1Title"), body: t("introStep1Body") },
    { icon: <Ticket className="h-5 w-5" />, title: t("introStep2Title"), body: t("introStep2Body") },
    {
      icon: <Navigation className="h-5 w-5" />,
      title: t("introStep3Title"),
      body: t("introStep3Body"),
    },
  ];

  return (
    <BottomSheet open={open} onClose={close} title={t("introTitle")}>
      <div className="space-y-4">
        <ol className="space-y-3.5">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                {step.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <Button size="lg" className="w-full" onClick={close}>
          {t("introStartCta")}
        </Button>
      </div>
    </BottomSheet>
  );
}
