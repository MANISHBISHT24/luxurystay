import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { availablePhysicalRooms, parseStay, quoteForRoom } from "@/lib/inventory";
import { paymentReady, createPaymentOrder } from "@/lib/payments";
import { consumeRateLimit } from "@/lib/rate-limit";
import { HttpError, isSameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your reservations." }, { status: 401 });
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      include: { roomType: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return NextResponse.json({ bookings });
  } catch {
    return NextResponse.json({ error: "Your reservations are temporarily unavailable." }, { status: 503 });
  }
}

const schema = z.object({
  roomType: z.string().min(1).max(100),
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.coerce.number().int().min(1).max(12),
  children: z.coerce.number().int().min(0).max(12),
  roomCount: z.coerce.number().int().min(1).max(4),
  fullName: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  couponCode: z.string().trim().max(40).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "booking", 10, 60_000)) {
      return NextResponse.json({ error: "Please wait a moment before trying again." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter valid guest and stay details." }, { status: 400 });
    const idempotencyKey = request.headers.get("idempotency-key") || "";
    if (!/^[a-zA-Z0-9-]{16,128}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: "Refresh the page and try booking again." }, { status: 400 });
    }
    const input = parsed.data;
    let dates: ReturnType<typeof parseStay>;
    try {
      const settings = await prisma.hotelSetting.findUnique({ where: { id: 1 }, select: { timezone: true } });
      dates = parseStay(input.checkIn, input.checkOut, settings?.timezone);
    } catch (error) {
      throw new HttpError(error instanceof Error ? error.message : "Choose valid dates.", 400);
    }
    const email = input.email.toLowerCase();
    const fingerprint = createHash("sha256").update(JSON.stringify({ ...input, email })).digest("hex");
    const signedInUser = await currentUser();
    if (!signedInUser) return NextResponse.json({ error: "Sign in to reserve a room and manage its cancellation." }, { status: 401 });
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey }, include: { payments: true } });
    if (existing) {
      if (existing.userId !== signedInUser.id) throw new HttpError("This booking request has already been used.", 409);
      if (existing.requestHash !== fingerprint) throw new HttpError("This booking request has already been used.", 409);
      return respond(existing);
    }

    const reference = randomBytes(16).toString("hex").toUpperCase();
    const booking = await prisma.$transaction(async (tx) => {
      const prior = await tx.booking.findUnique({ where: { idempotencyKey }, include: { payments: true } });
      if (prior) {
        if (prior.userId !== signedInUser.id) throw new HttpError("This booking request has already been used.", 409);
        if (prior.requestHash !== fingerprint) throw new HttpError("This booking request has already been used.", 409);
        return prior;
      }
      const roomType = await tx.roomType.findUnique({ where: { slug: input.roomType, active: true } });
      if (!roomType) throw new HttpError("That room is not available for booking.", 404);
      if (input.adults + input.children > roomType.maxGuests * input.roomCount ||
          Math.ceil((input.adults + input.children) / input.roomCount) > roomType.maxGuests) {
        throw new HttpError("That room does not have space for your party size.", 400);
      }
      const available = await availablePhysicalRooms(tx, roomType.id, dates.checkIn, dates.checkOut, input.roomCount);
      if (available.length !== input.roomCount) throw new HttpError("Those dates are no longer available.", 409);
      const quote = await quoteForRoom({
        client: tx,
        roomTypeId: roomType.id,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        roomCount: input.roomCount,
        couponCode: input.couponCode || undefined
      });
      if (quote.coupon) {
        const result = await tx.coupon.updateMany({
          where: { id: quote.coupon.id, active: true, OR: [{ maxUses: null }, { uses: { lt: quote.coupon.maxUses ?? 0 } }] },
          data: { uses: { increment: 1 } }
        });
        if (!result.count) throw new HttpError("That offer code has reached its limit.", 409);
      }
      const saved = await tx.booking.create({
        data: {
          reference,
          idempotencyKey,
          requestHash: fingerprint,
          userId: signedInUser?.id,
          roomTypeId: roomType.id,
          checkIn: dates.checkIn,
          checkOut: dates.checkOut,
          adults: input.adults,
          children: input.children,
          roomCount: input.roomCount,
          expiresAt: new Date(Date.now() + 15 * 60_000),
          subtotal: quote.price.subtotal,
          taxAmount: quote.price.taxAmount,
          discountAmount: quote.price.discountAmount,
          total: quote.price.total,
          couponId: quote.coupon?.id,
          guests: { create: { fullName: input.fullName, email, phone: input.phone || null, isPrimary: true } },
          rooms: { create: available.map((room) => ({ roomId: room.id })) }
        },
        include: { payments: true }
      });
      await tx.auditLog.create({
        data: {
          userId: signedInUser?.id,
          action: "BOOKING_CREATED",
          entity: "Booking",
          entityId: saved.id,
          details: { status: "PENDING" }
        }
      });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return respond(booking);
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Availability changed while securing your stay. Please try again." }, { status: 409 });
    }
    return NextResponse.json({ error: "We could not secure that stay. Please try again." }, { status: 503 });
  }
}

async function respond(booking: {
  id: string;
  reference: string;
  status: string;
  expiresAt: Date;
  total: { toNumber(): number };
}) {
  if (booking.status !== "PENDING" || booking.expiresAt <= new Date()) {
    return NextResponse.json({ error: "This reservation hold has expired. Please choose your stay again." }, { status: 409 });
  }
  try {
    const payment = paymentReady() ? await createPaymentOrder(booking) : null;
    return NextResponse.json({
      booking: { reference: booking.reference, status: booking.status },
      payment: payment ? { ...payment, key: process.env.RAZORPAY_KEY_ID } : null
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The room is held, but payment setup is unavailable. Please contact the resort." }, { status: 503 });
  }
}
