import { describe, expect, it } from "vitest";
import type { BusinessType } from "@/types";
import { bookingModel, isAppointmentModel, isQueueModel } from "./business-model";

describe("bookingModel", () => {
  it("puts salons on the queue", () => {
    expect(bookingModel("SALON")).toBe("QUEUE");
  });

  it("puts parlours on appointments", () => {
    expect(bookingModel("PARLOUR")).toBe("APPOINTMENT");
  });

  it("reads the legacy UNISEX value as a queue, which is what those shops run", () => {
    expect(bookingModel("UNISEX")).toBe("QUEUE");
  });

  // The shop row arrives one render after the component mounts. Answering
  // "APPOINTMENT" for that frame would flash a parlour screen at every salon.
  it("falls back to the queue while the shop is still loading", () => {
    expect(bookingModel(null)).toBe("QUEUE");
    expect(bookingModel(undefined)).toBe("QUEUE");
  });

  // A value added to the database enum before the deploy that understands it.
  // Guessing "APPOINTMENT" would hand the owner a screen that cannot take work;
  // the queue is the model that is fully built, so that is the safe direction.
  it("falls back to the queue for an enum value it does not know", () => {
    expect(bookingModel("CAR_WASH" as BusinessType)).toBe("QUEUE");
  });
});

describe("isAppointmentModel / isQueueModel", () => {
  it("agree with bookingModel and never with each other", () => {
    const types: (BusinessType | null)[] = ["SALON", "PARLOUR", "UNISEX", null];
    for (const type of types) {
      expect(isAppointmentModel(type)).toBe(bookingModel(type) === "APPOINTMENT");
      expect(isQueueModel(type)).toBe(!isAppointmentModel(type));
    }
  });
});
