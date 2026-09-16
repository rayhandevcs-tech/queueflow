"use client";

import {
  parsePreference,
  preferredBookingModel,
  type CustomerPreference,
} from "@/lib/customer-preference";
import type { BookingModel } from "@/lib/business-model";
import { useMyProfile } from "./use-my-profile";
import { useUpdateMyProfile } from "./use-profile-mutations";

/**
 * The customer's default experience, in one place.
 *
 * Every screen that behaves differently for a salon-minded customer than for a
 * parlour-minded one asks this — the explore list, the bookings page, the
 * navigation labels — so the rule lives here and not in three `=== "PARLOUR"`
 * comparisons that could drift apart.
 *
 * It returns a `BookingModel`, not the raw preference, deliberately: that is
 * the abstraction the rest of the app already reasons in (`bookingModel()`,
 * `byModel()`, the terminology layer), so a preference-driven screen and a
 * shop-driven screen speak the same language and a third vertical later
 * changes one file.
 *
 * `preference` is also returned raw, for the one thing the model cannot
 * express: whether the customer ever answered at all. `null` there means a
 * legacy account, and screens that want to invite them to choose need to know
 * the difference between "chose salon" and "never asked".
 *
 * No query of its own — it reads the profile every customer screen already
 * has cached, so switching on the preference costs nothing.
 */
export function usePreferredExperience(): {
  preference: CustomerPreference | null;
  model: BookingModel;
  hasChosen: boolean;
  isPending: boolean;
} {
  const { data: profile, isPending } = useMyProfile();
  const preference = parsePreference(profile?.preferred_business_type);

  return {
    preference,
    model: preferredBookingModel(preference),
    hasChosen: preference !== null,
    isPending,
  };
}

/**
 * Change it later.
 *
 * Goes through the ordinary profile update — one row, the caller's own, guarded
 * by the same `profiles: update own` policy as their name and phone. There is
 * no RPC and no service-role path, so a customer cannot reach anybody else's
 * preference even by editing the request: the policy's USING clause hides the
 * row, and the update touches nothing.
 */
export function useSetPreferredExperience() {
  const update = useUpdateMyProfile();
  return {
    ...update,
    setPreference: (preference: CustomerPreference) =>
      update.mutate({ preferred_business_type: preference }),
  };
}
