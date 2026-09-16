"use client";

import { Flower2, Scissors } from "lucide-react";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { accountDict } from "../lib/i18n";
import {
  usePreferredExperience,
  useSetPreferredExperience,
} from "../hooks/use-preferred-experience";

/**
 * Change the default experience after signup.
 *
 * Customers only — a shop owner's equivalent is `shops.business_type`, which
 * lives in shop settings and means something entirely different. The account
 * page decides which of the two to render; this component never guesses.
 *
 * It saves on tap, with no confirm step: the change is instantly visible, the
 * blast radius is one screen's default, and a "Save" button for a two-option
 * preference is ceremony. A failure says so and leaves the old value selected,
 * because the profile query is the source of truth and it was never updated.
 *
 * The unset case gets its own line rather than an empty control. Every account
 * created before Sprint 11 is in it, and "you haven't chosen; you're on the
 * salon queue meanwhile" is more useful than a silently-unselected pair of
 * chips.
 */
export function ExperiencePreferenceField() {
  const t = useT(accountDict);
  const { preference, hasChosen, isPending } = usePreferredExperience();
  const { setPreference, isPending: saving, isError } = useSetPreferredExperience();

  const OPTIONS = [
    { value: "SALON" as const, label: t("experienceSalon"), icon: Scissors },
    { value: "PARLOUR" as const, label: t("experienceParlour"), icon: Flower2 },
  ];

  if (isPending) {
    return (
      <div className="grid min-h-16 place-items-center">
        <Spinner className="h-4 w-4 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-ink">{t("experienceLabel")}</p>
        {saving && <Spinner className="h-3.5 w-3.5 text-muted" />}
      </div>

      <ChipGroup
        options={OPTIONS}
        value={preference ?? undefined}
        onChange={setPreference}
        ariaLabel={t("experienceLabel")}
      />

      {!hasChosen && <p className="text-xs leading-relaxed text-brass">{t("experienceUnset")}</p>}
      <p className="text-xs leading-relaxed text-muted">{t("experienceHint")}</p>
      {isError && <p className="text-xs font-medium text-live">{t("experienceSaveFailed")}</p>}
    </div>
  );
}
