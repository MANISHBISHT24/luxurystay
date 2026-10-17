import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !supplied) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const expectedHash = createHash("sha256").update(secret).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(expectedHash, suppliedHash)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const expired = await prisma.booking.findMany({
      where: { status: "PENDING", expiresAt: { lte: new Date() } },
      select: { id: true, couponId: true },
      take: 1000
    });
    let count = 0;
    for (const booking of expired) {
      count += await prisma.$transaction(async (tx) => {
        const changed = await tx.booking.updateMany({
          where: { id: booking.id, status: "PENDING", expiresAt: { lte: new Date() } },
          data: { status: "EXPIRED" }
        });
        if (!changed.count) return 0;
        if (booking.couponId) {
          await tx.coupon.updateMany({ where: { id: booking.couponId, uses: { gt: 0 } }, data: { uses: { decrement: 1 } } });
        }
        await tx.auditLog.create({ data: { action: "BOOKING_HOLD_EXPIRED", entity: "Booking", entityId: booking.id } });
        return changed.count;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    return NextResponse.json({ expired: count });
  } catch {
    return NextResponse.json({ error: "Expired holds could not be processed." }, { status: 503 });
  }
}
