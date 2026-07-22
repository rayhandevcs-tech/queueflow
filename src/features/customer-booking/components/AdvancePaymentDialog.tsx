"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format-wait";
import { paymentGateway } from "@/lib/payment/mock-gateway";
import type { PaymentMethod } from "@/lib/payment/types";
import type { AdvancePaymentInfo } from "../api/booking.api";

const METHODS: { id: PaymentMethod; label: string; color: string }[] = [
  { id: "bkash", label: "বিকাশ", color: "#E2136E" },
  { id: "nagad", label: "নগদ", color: "#F6921E" },
];

type Step = "method" | "pin" | "processing" | "success" | "error";

export function AdvancePaymentDialog({
  amount,
  onSuccess,
  onClose,
}: {
  amount: number;
  onSuccess: (info: AdvancePaymentInfo) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const selectedMethod = METHODS.find((m) => m.id === method);

  const charge = async () => {
    if (!method) return;
    setStep("processing");
    const result = await paymentGateway.charge({ method, phone, pin, amount });
    if (result.ok) {
      setStep("success");
      setTimeout(() => onSuccess({ method, transactionId: result.transactionId }), 900);
    } else {
      setError(result.message);
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-card p-5">
        {step !== "processing" && step !== "success" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {step === "method" && (
          <div>
            <p className="mb-1 font-display text-lg font-bold text-ink">অ্যাডভান্স পেমেন্ট</p>
            <p className="mb-4.5 text-[13px] text-muted">মোট ৳{formatMoney(amount)} — মেথড বেছে নাও</p>

            <div className="mb-4.5 flex gap-3">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex-1 rounded-2xl border-1.5 py-4 text-center font-display font-bold text-white transition-transform",
                    method === m.id && "scale-105",
                  )}
                  style={{
                    background: m.color,
                    borderColor: method === m.id ? "var(--color-ink)" : "transparent",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label className="mb-1.5 block text-xs font-medium text-muted">
              {selectedMethod?.label ?? ""} নাম্বার
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              className="w-full rounded-xl border border-line bg-soft px-3.5 py-2.75 text-sm text-ink placeholder:text-muted"
            />

            <button
              type="button"
              disabled={!method || phone.length !== 11}
              onClick={() => setStep("pin")}
              className="mt-4.5 w-full rounded-[14px] bg-accent py-3.25 font-display text-sm font-bold text-accent-ink disabled:opacity-50"
            >
              পরবর্তী
            </button>
          </div>
        )}

        {step === "pin" && selectedMethod && (
          <div>
            <button
              type="button"
              onClick={() => setStep("method")}
              className="mb-3 flex items-center gap-1 text-xs font-medium text-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              ফিরে যাও
            </button>
            <div
              className="mb-4.5 rounded-2xl p-4 text-white"
              style={{ background: selectedMethod.color }}
            >
              <p className="text-xs opacity-80">{selectedMethod.label} · {phone}</p>
              <p className="mt-1 font-number text-2xl font-bold">৳{formatMoney(amount)}</p>
            </div>
            <label className="mb-1.5 block text-xs font-medium text-muted">PIN দাও</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              type="password"
              placeholder="••••"
              className="w-full rounded-xl border border-line bg-soft px-3.5 py-2.75 text-center text-lg tracking-widest text-ink"
            />
            <button
              type="button"
              disabled={pin.length < 4}
              onClick={charge}
              className="mt-4.5 w-full rounded-[14px] py-3.25 font-display text-sm font-bold text-white disabled:opacity-50"
              style={{ background: selectedMethod.color }}
            >
              পে করো ৳{formatMoney(amount)}
            </button>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-accent border-t-transparent" />
            <p className="text-sm text-muted">পেমেন্ট প্রসেস হচ্ছে…</p>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-good-soft text-good">
              <Check className="h-7 w-7" />
            </div>
            <p className="font-display text-base font-bold text-ink">পেমেন্ট সফল হয়েছে</p>
            <p className="mt-1 text-xs text-muted">সিরিয়াল কনফার্ম হচ্ছে…</p>
          </div>
        )}

        {step === "error" && (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-live-soft text-live">
              <AlertCircle className="h-7 w-7" />
            </div>
            <p className="font-display text-base font-bold text-ink">পেমেন্ট ব্যর্থ হয়েছে</p>
            <p className="mt-1 text-xs text-muted">{error}</p>
            <button
              type="button"
              onClick={() => setStep("pin")}
              className="mt-4.5 w-full rounded-[14px] bg-accent py-3.25 font-display text-sm font-bold text-accent-ink"
            >
              আবার চেষ্টা করো
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
