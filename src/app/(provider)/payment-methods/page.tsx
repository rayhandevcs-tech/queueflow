import { redirect } from "next/navigation";

/** Payment methods moved into shop settings' "accepted payments" section (Sprint 18). */
export default function PaymentMethodsPage() {
  redirect("/settings");
}
