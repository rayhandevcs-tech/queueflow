import type { PaymentChargeRequest, PaymentChargeResult, PaymentGateway } from "./types";
import { translate, type Dict } from "@/lib/i18n";

function randomTxnId(): string {
  return `MOCK${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

const dict = {
  invalidPhone: {
    bn: "সঠিক ১১ ডিজিটের নাম্বার দাও (01XXXXXXXXX)",
    en: "Enter a valid 11-digit number (01XXXXXXXXX)",
  },
  invalidPin: { bn: "PIN ৪-৫ ডিজিটের হতে হবে", en: "PIN must be 4-5 digits" },
  paymentFailed: {
    bn: "পেমেন্ট ব্যর্থ হয়েছে — ব্যালেন্স বা PIN ঠিক আছে কিনা দেখো",
    en: "Payment failed — check your balance or PIN",
  },
} satisfies Dict;

/**
 * Simulated bKash/Nagad checkout — no real money moves. Mimics real gateway
 * latency and failure modes so the UI (loading/success/error states) behaves
 * like it will against a real one. PIN "0000" deliberately fails, so the
 * error path is reachable without special test hooks.
 */
export class MockPaymentGateway implements PaymentGateway {
  async charge(req: PaymentChargeRequest): Promise<PaymentChargeResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (!/^01\d{9}$/.test(req.phone)) {
      return { ok: false, message: translate(dict, "invalidPhone") };
    }
    if (!/^\d{4,5}$/.test(req.pin)) {
      return { ok: false, message: translate(dict, "invalidPin") };
    }
    if (req.pin === "0000") {
      return { ok: false, message: translate(dict, "paymentFailed") };
    }

    return { ok: true, transactionId: randomTxnId() };
  }
}

export const paymentGateway = new MockPaymentGateway();
