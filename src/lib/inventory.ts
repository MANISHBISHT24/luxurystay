import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateQuote } from "@/lib/pricing";
import { hotelDate } from "@/lib/hotel-time";

export function parseStay(checkInText: string, checkOutText: string, timezone?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInText) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutText)) {
    throw new Error("Choose valid check-in and check-out dates.");
  }
  const checkIn = new Date(checkInText + "T00:00:00.000Z");
  const checkOut = new Date(checkOutText + "T00:00:00.000Z");
  const today = new Date(hotelDate(new Date(), timezone) + "T00:00:00.000Z");
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) ||
      checkIn.toISOString().slice(0, 10) !== checkInText ||
      checkOut.toISOString().slice(0, 10) !== checkOutText ||
      checkIn.getTime() < today.getTime() || checkOut <= checkIn ||
      (checkOut.getTime() - checkIn.getTime()) / 86_400_000 > 60) {
    throw new Error("Choose valid dates for a stay of 1 to 60 nights.");
  }
  return { checkIn, checkOut };
}

export async function availablePhysicalRooms(
  tx: Prisma.TransactionClient,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  roomCount: number,
  now = new Date()
) {
  return tx.room.findMany({
    where: {
      typeId: roomTypeId,
      reservations: {
        none: {
          booking: {
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
            OR: [
              { status: "CONFIRMED" },
              { status: "PENDING", expiresAt: { gt: now } }
            ]
          }
        }
      }
    },
    select: { id: true },
    orderBy: { number: "asc" },
    take: roomCount
  });
}

export async function searchAvailableRooms(checkInText: string, checkOutText: string, guests: number, roomCount: number) {
  const settings = await prisma.hotelSetting.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const dates = parseStay(checkInText, checkOutText, settings?.timezone);
  const roomTypes = await prisma.roomType.findMany({
    where: { active: true, maxGuests: { gte: Math.ceil(guests / roomCount) } },
    orderBy: { basePrice: "asc" }
  });
  const available = [];
  for (const roomType of roomTypes) {
    const inventory = await prisma.$transaction((tx) =>
      availablePhysicalRooms(tx, roomType.id, dates.checkIn, dates.checkOut, roomCount)
    );
    if (inventory.length !== roomCount) continue;
    const quote = await quoteForRoom({
      client: prisma,
      roomTypeId: roomType.id,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      roomCount
    });
    available.push({ roomType, quote: quote.price });
  }
  return { dates, available };
}

export async function quoteForRoom({
  client,
  roomTypeId,
  checkIn,
  checkOut,
  roomCount,
  couponCode
}: {
  client: Pick<typeof prisma, "roomType" | "hotelSetting" | "seasonalRate" | "coupon">;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  roomCount: number;
  couponCode?: string;
}) {
  const [roomType, settings, seasonalRates, coupon] = await Promise.all([
    client.roomType.findUnique({ where: { id: roomTypeId, active: true } }),
    client.hotelSetting.findUnique({ where: { id: 1 } }),
    client.seasonalRate.findMany({
      where: { roomTypeId, startsOn: { lt: checkOut }, endsOn: { gt: checkIn } },
      orderBy: { startsOn: "desc" }
    }),
    couponCode ? client.coupon.findUnique({ where: { code: couponCode.toUpperCase() } }) : null
  ]);
  if (!roomType) throw new Error("That room is not available for booking.");
  if (couponCode && (!coupon || !coupon.active ||
      (coupon.startsAt && coupon.startsAt > new Date()) ||
      (coupon.endsAt && coupon.endsAt < new Date()) ||
      (coupon.maxUses !== null && coupon.uses >= coupon.maxUses))) {
    throw new Error("That offer code is not valid.");
  }
  const price = calculateQuote({
    checkIn,
    checkOut,
    baseRate: roomType.basePrice,
    seasonalRates,
    roomCount,
    taxPercent: settings ? settings.taxPercent.toNumber() : Number(process.env.HOTEL_TAX_PERCENT || 12),
    coupon: coupon ? { kind: coupon.kind, value: coupon.value } : undefined
  });
  return { roomType, settings, coupon, price };
}
