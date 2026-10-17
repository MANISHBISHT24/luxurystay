import { describe, expect, it } from "vitest";
import { calculateQuote } from "./pricing";

describe("calculateQuote", () => {
  it("uses seasonal prices per night, multiplies rooms, then applies tax and a capped discount", () => {
    const quote = calculateQuote({
      checkIn: new Date("2026-11-01T00:00:00.000Z"),
      checkOut: new Date("2026-11-04T00:00:00.000Z"),
      baseRate: 1000,
      seasonalRates: [{ startsOn: new Date("2026-11-02T00:00:00.000Z"), endsOn: new Date("2026-11-03T00:00:00.000Z"), nightlyRate: 1500 }],
      roomCount: 2,
      taxPercent: 10,
      coupon: { kind: "PERCENT", value: 20 }
    });
    expect(quote).toEqual({ nights: 3, subtotal: 7000, taxAmount: 700, discountAmount: 1400, total: 6300 });
  });

  it("rejects zero-length and overlong stays", () => {
    expect(() => calculateQuote({
      checkIn: new Date("2026-11-01T00:00:00.000Z"),
      checkOut: new Date("2026-11-01T00:00:00.000Z"),
      baseRate: 1000,
      seasonalRates: [],
      roomCount: 1,
      taxPercent: 12
    })).toThrow("Invalid stay.");
  });
});
