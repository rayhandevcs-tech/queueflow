import { describe, expect, it } from "vitest";
import type { BusinessType } from "@/types";
import { term, useTerms, type TermKey } from "./business-terms";

const KEYS: TermKey[] = [
  "chair",
  "chairs",
  "staff",
  "staffMember",
  "venue",
  "board",
];

describe("term", () => {
  it("gives a salon chairs and a parlour seats", () => {
    expect(term("chair", "SALON", "bn")).toBe("চেয়ার");
    expect(term("chair", "PARLOUR", "bn")).toBe("সিট");
    expect(term("chair", "SALON", "en")).toBe("Chair");
    expect(term("chair", "PARLOUR", "en")).toBe("Seat");
  });

  it("names the parlour's home screen after appointments, not a queue", () => {
    expect(term("board", "PARLOUR", "bn")).toBe("অ্যাপয়েন্টমেন্ট");
    expect(term("board", "PARLOUR", "en")).toBe("Appointments");
  });

  // The provider sidebar's first item used to be a fixed `navLiveQueue` string
  // and now resolves through `board`. For a salon the label must not have moved
  // a character — a nav item quietly renaming itself is the kind of regression
  // nobody files a bug for.
  //
  // Asserted as literals rather than by importing providerCatalogDict: this
  // file is shared code, and shared may not import a feature (eslint
  // boundaries). The values below are that dictionary's `navLiveQueue`.
  it("leaves the salon's sidebar label exactly as it was", () => {
    expect(term("board", "SALON", "bn")).toBe("লাইভ সিরিয়াল");
    expect(term("board", "SALON", "en")).toBe("Live queue");
  });

  it("reads an unknown or missing type as a salon", () => {
    for (const key of KEYS) {
      expect(term(key, null, "bn")).toBe(term(key, "SALON", "bn"));
      expect(term(key, "UNISEX", "bn")).toBe(term(key, "SALON", "bn"));
      expect(term(key, "CAR_WASH" as BusinessType, "bn")).toBe(term(key, "SALON", "bn"));
    }
  });

  // A missing entry would render "undefined" into the UI rather than throwing,
  // so the completeness of both sets is worth asserting rather than trusting.
  it("has a non-empty bn and en string for every key in both sets", () => {
    for (const type of ["SALON", "PARLOUR"] as const) {
      for (const key of KEYS) {
        expect(term(key, type, "bn")).toBeTruthy();
        expect(term(key, type, "en")).toBeTruthy();
      }
    }
  });

  it("actually differs between the two trades wherever it claims to", () => {
    // These are the words the whole layer exists for. If any pair collapses,
    // a parlour owner is reading salon vocabulary again.
    for (const key of ["chair", "chairs", "staff", "staffMember", "venue", "board"] as const) {
      expect(term(key, "SALON", "bn")).not.toBe(term(key, "PARLOUR", "bn"));
    }
  });
});

describe("useTerms", () => {
  it("returns a resolver bound to one shop's type and language", () => {
    const tt = useTerms("PARLOUR", "bn");
    expect(tt("chair")).toBe("সিট");
    expect(tt("board")).toBe("অ্যাপয়েন্টমেন্ট");
  });

  it("agrees with term() for every key", () => {
    for (const type of ["SALON", "PARLOUR", "UNISEX", null] as const) {
      for (const lang of ["bn", "en"] as const) {
        // `useTerms` is a plain factory, not a React hook — it holds no state
        // and takes its language as an argument (see its own doc comment). The
        // `use` prefix is what trips the rule, and renaming it would churn
        // three working call sites to satisfy a linter about a test loop.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const tt = useTerms(type, lang);
        for (const key of KEYS) expect(tt(key)).toBe(term(key, type, lang));
      }
    }
  });
});
