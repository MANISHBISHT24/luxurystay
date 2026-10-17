export type RatePeriod = {
  startsOn: Date;
  endsOn: Date;
  nightlyRate: { toNumber(): number } | number;
};

export type CouponOffer =
  | { kind: "PERCENT"; value: { toNumber(): number } | number }
  | { kind: "FIXED"; value: { toNumber(): number } | number };

function toNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function dateKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function calculateQuote({
  checkIn,
  checkOut,
  baseRate,
  seasonalRates,
  roomCount,
  taxPercent,
  coupon
}: {
  checkIn: Date;
  checkOut: Date;
  baseRate: { toNumber(): number } | number;
  seasonalRates: RatePeriod[];
  roomCount: number;
  taxPercent: number;
  coupon?: CouponOffer;
}) {
  const firstNight = dateKey(checkIn);
  const lastNight = dateKey(checkOut);
  const nights = (lastNight - firstNight) / 86_400_000;
  if (!Number.isInteger(nights) || nights < 1 || nights > 60 || roomCount < 1 || roomCount > 4) {
    throw new Error("Invalid stay.");
  }

  const baseCents = Math.round(toNumber(baseRate) * 100);
  const ratePeriods = seasonalRates.map((rate) => ({
    starts: dateKey(rate.startsOn),
    ends: dateKey(rate.endsOn),
    cents: Math.round(toNumber(rate.nightlyRate) * 100)
  }));
  let subtotalCents = 0;
  for (let night = firstNight; night < lastNight; night += 86_400_000) {
    const rate = ratePeriods.find((period) => period.starts <= night && period.ends > night);
    subtotalCents += (rate?.cents ?? baseCents) * roomCount;
  }
  const taxCents = Math.round(subtotalCents * taxPercent / 100);
  const beforeDiscount = subtotalCents + taxCents;
  const couponValue = coupon ? toNumber(coupon.value) : 0;
  const discountCents = coupon
    ? Math.min(subtotalCents, coupon.kind === "PERCENT" ? Math.round(subtotalCents * couponValue / 100) : Math.round(couponValue * 100))
    : 0;
  return {
    nights,
    subtotal: subtotalCents / 100,
    taxAmount: taxCents / 100,
    discountAmount: discountCents / 100,
    total: (beforeDiscount - discountCents) / 100
  };
}
