import { describe, expect, it } from "vitest";
import { translateDbError, UiDbError, withDbErrors } from "./db-errors";
import { setStoredLanguage } from "@/lib/i18n";

/** getStoredLanguage/setStoredLanguage no-op without `window` (vitest runs in a plain Node environment). */
function withFakeLocalStorage<T>(run: () => T): T {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
  try {
    return run();
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
}

function pgError(message: string) {
  return { message, details: "", code: "" };
}

describe("translateDbError", () => {
  it("maps the one-active-serial constraint violation to a friendly, non-silent message", () => {
    const result = translateDbError(pgError('duplicate key value violates unique constraint "one_active_serial_per_customer"'));
    expect(result.silent).toBe(false);
    expect(result.message).toContain("একটা সিরিয়াল চলছে");
  });

  it("maps a closed-shop rejection to a friendly, non-silent message", () => {
    const result = translateDbError(pgError("shop is not open"));
    expect(result.silent).toBe(false);
    expect(result.message).toContain("বন্ধ");
  });

  it("maps no-chair-available to a friendly, non-silent message", () => {
    const result = translateDbError(pgError("no chair available for the requested services"));
    expect(result.silent).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("maps chair-cannot-perform to a friendly, non-silent message", () => {
    const result = translateDbError(pgError("this chair cannot perform the selected service"));
    expect(result.silent).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("silences an invalid-status-transition race (realtime already reconciles the board)", () => {
    const result = translateDbError(pgError("invalid status transition WAITING -> DONE"));
    expect(result.silent).toBe(true);
    expect(result.message).toBe("");
  });

  it("silences a one-in-progress-per-chair race (double [Start] tap)", () => {
    const result = translateDbError(pgError('violates unique constraint "one_in_progress_per_chair"'));
    expect(result.silent).toBe(true);
    expect(result.message).toBe("");
  });

  it("treats a Postgres deadlock as retryable and non-silent", () => {
    const result = translateDbError(pgError("deadlock detected"));
    expect(result.silent).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("also recognizes the deadlock SQLSTATE code even without the word 'deadlock'", () => {
    const result = translateDbError({ message: "", details: "", code: "40P01" });
    expect(result.silent).toBe(false);
  });

  it("maps invalid service selection to a friendly, non-silent message", () => {
    const result = translateDbError(pgError("invalid service selection: unknown id"));
    expect(result.silent).toBe(false);
  });

  it("falls back to a generic message for an unrecognized error", () => {
    const result = translateDbError(pgError("some completely unrelated Postgres error"));
    expect(result.silent).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("falls back to generic for a non-object thrown value", () => {
    const result = translateDbError("plain string error");
    expect(result.silent).toBe(false);
  });

  it("switches to English messages when the stored language is en", () => {
    withFakeLocalStorage(() => {
      setStoredLanguage("en");
      const result = translateDbError(pgError('violates unique constraint "one_active_serial_per_customer"'));
      expect(result.message).toContain("already has a serial running");
    });
  });
});

describe("withDbErrors", () => {
  it("passes through a successful result unchanged", async () => {
    await expect(withDbErrors(async () => "ok")).resolves.toBe("ok");
  });

  it("wraps a rejected promise's Postgres error into a UiDbError with the translated message", async () => {
    await expect(
      withDbErrors(async () => {
        throw pgError("shop is not open");
      }),
    ).rejects.toThrow(UiDbError);
  });

  it("marks a silenced race error's UiDbError as silent", async () => {
    try {
      await withDbErrors(async () => {
        throw pgError("invalid status transition");
      });
      expect.unreachable("expected withDbErrors to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UiDbError);
      expect((err as UiDbError).silent).toBe(true);
    }
  });
});
