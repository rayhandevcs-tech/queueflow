export type PaymentMethod = "bkash" | "nagad";

export interface PaymentChargeRequest {
  method: PaymentMethod;
  phone: string;
  pin: string;
  amount: number;
}

export interface PaymentChargeSuccess {
  ok: true;
  transactionId: string;
}

export interface PaymentChargeFailure {
  ok: false;
  message: string;
}

export type PaymentChargeResult = PaymentChargeSuccess | PaymentChargeFailure;

/**
 * Swap-in point for a real gateway later — anything that implements
 * `charge()` this way can replace MockPaymentGateway without touching
 * AdvancePaymentDialog or the booking flow.
 */
export interface PaymentGateway {
  charge(req: PaymentChargeRequest): Promise<PaymentChargeResult>;
}
