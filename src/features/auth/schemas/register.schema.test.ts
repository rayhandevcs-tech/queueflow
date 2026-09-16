import { describe, expect, it } from "vitest";
import { registerSchema } from "./register.schema";

const schema = registerSchema("bn");

function values(over: Record<string, unknown> = {}) {
  return {
    fullName: "রুমি আক্তার",
    email: "rumi@example.com",
    phone: "01712345678",
    password: "secret123",
    confirmPassword: "secret123",
    role: "customer",
    ...over,
  };
}

describe("customer registration asks which experience they came for", () => {
  it("**accepts a SALON customer**", () => {
    const parsed = schema.safeParse(values({ preferredBusinessType: "SALON" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.preferredBusinessType).toBe("SALON");
  });

  it("**accepts a PARLOUR customer**", () => {
    const parsed = schema.safeParse(values({ preferredBusinessType: "PARLOUR" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.preferredBusinessType).toBe("PARLOUR");
  });

  it("**refuses a customer who chose neither**", () => {
    // Not optional for a new account: the nullable column exists so that
    // LEGACY rows can be honest about never having been asked, not so that
    // new ones can skip the question.
    const parsed = schema.safeParse(values());
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "preferredBusinessType")).toBe(true);
    }
  });

  it("refuses UNISEX — a shop can be unisex, a customer cannot prefer it", () => {
    expect(schema.safeParse(values({ preferredBusinessType: "UNISEX" })).success).toBe(false);
  });

  it("refuses the right value in the wrong case", () => {
    expect(schema.safeParse(values({ preferredBusinessType: "salon" })).success).toBe(false);
  });

  it("carries a Bangla message a customer can act on", () => {
    const parsed = schema.safeParse(values());
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === "preferredBusinessType");
      expect(issue?.message).toBe("কোন ধরনের সেবা নিতে চাও বেছে নাও");
    }
  });

  it("and an English one when the form is in English", () => {
    const parsed = registerSchema("en").safeParse(values());
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === "preferredBusinessType");
      expect(issue?.message).toBe("Choose which kind of service you want");
    }
  });
});

describe("provider registration is unchanged", () => {
  it("**still requires the shop's own business type**", () => {
    const parsed = schema.safeParse(values({ role: "provider" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "businessType")).toBe(true);
    }
  });

  it("**does not require a customer preference from an owner**", () => {
    const parsed = schema.safeParse(values({ role: "provider", businessType: "PARLOUR" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.preferredBusinessType).toBeUndefined();
  });

  it("keeps the two fields apart — an owner's type is not a preference", () => {
    const parsed = schema.safeParse(
      values({ role: "provider", businessType: "SALON", preferredBusinessType: "PARLOUR" }),
    );
    // Both may be present without contradiction: they answer different
    // questions, and nothing downstream reads one as the other.
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.businessType).toBe("SALON");
      expect(parsed.data.preferredBusinessType).toBe("PARLOUR");
    }
  });
});

describe("the rest of the form still validates as before", () => {
  it("rejects a mismatched confirmation", () => {
    const parsed = schema.safeParse(
      values({ preferredBusinessType: "SALON", confirmPassword: "different" }),
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-Bangladeshi phone number", () => {
    const parsed = schema.safeParse(
      values({ preferredBusinessType: "SALON", phone: "+44 7700 900000" }),
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects a short password and a bad email", () => {
    expect(
      schema.safeParse(values({ preferredBusinessType: "SALON", password: "123", confirmPassword: "123" }))
        .success,
    ).toBe(false);
    expect(
      schema.safeParse(values({ preferredBusinessType: "SALON", email: "not-an-email" })).success,
    ).toBe(false);
  });
});
