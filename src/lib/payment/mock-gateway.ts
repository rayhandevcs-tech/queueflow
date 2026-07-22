import type { PaymentChargeRequest, PaymentChargeResult, PaymentGateway } from "./types";

function randomTxnId(): string {
  return `MOCK${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

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
      return { ok: false, message: "সঠিক ১১ ডিজিটের নাম্বার দাও (01XXXXXXXXX)" };
    }
    if (!/^\d{4,5}$/.test(req.pin)) {
      return { ok: false, message: "PIN ৪-৫ ডিজিটের হতে হবে" };
    }
    if (req.pin === "0000") {
      return { ok: false, message: "পেমেন্ট ব্যর্থ হয়েছে — ব্যালেন্স বা PIN ঠিক আছে কিনা দেখো" };
    }

    return { ok: true, transactionId: randomTxnId() };
  }
}

export const paymentGateway = new MockPaymentGateway();
