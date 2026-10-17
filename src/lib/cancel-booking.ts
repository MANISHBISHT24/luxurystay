import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/payments";
import { HttpError } from "@/lib/http";
import { hotelMidnight } from "@/lib/hotel-time";

export async function cancelBooking(bookingId: string, actorId: string, enforcePolicy: boolean) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payments: true } });
  if (!booking) throw new HttpError("Reservation was not found.", 404);
  if (booking.status === "CANCELLED") {
    return { status: "CANCELLED", refundStatus: (await prisma.refund.findFirst({ where: { bookingId } }))?.status || "NOT_REQUIRED" };
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") {
    throw new HttpError("This reservation can no longer be cancelled.", 409);
  }
  if (enforcePolicy && booking.status === "CONFIRMED") {
    const settings = await prisma.hotelSetting.findUnique({ where: { id: 1 } });
    const cutoff = hotelMidnight(booking.checkIn, settings?.timezone).getTime() - (settings?.cancellationHours ?? 48) * 3_600_000;
    if (Date.now() > cutoff) throw new HttpError("This rate is outside its free-cancellation window.", 409);
  }
  const payment = booking.payments.find((item) => item.status === "CAPTURED" && item.paymentId);
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: "CANCELLED" }
    });
    if (!changed.count) return { refund: await tx.refund.findFirst({ where: { bookingId } }), created: false };
    if (booking.couponId) {
      await tx.coupon.updateMany({ where: { id: booking.couponId, uses: { gt: 0 } }, data: { uses: { decrement: 1 } } });
    }
    const refund = payment ? await tx.refund.create({
      data: {
        bookingId: booking.id,
        paymentId: payment.id,
        providerPaymentId: payment.paymentId!,
        idempotencyKey: "cancel-refund:" + booking.id,
        amount: payment.amount
      }
    }) : null;
    await tx.auditLog.create({
      data: { userId: actorId, action: "BOOKING_CANCELLED", entity: "Booking", entityId: booking.id }
    });
    return { refund, created: Boolean(refund) };
  });
  if (result.refund && result.created && payment?.paymentId) {
    try {
      const response = await razorpay().payments.refund(payment.paymentId, {
        amount: Math.round(payment.amount.toNumber() * 100)
      });
      await prisma.refund.update({
        where: { id: result.refund.id },
        data: { providerId: response.id, status: response.status || "PENDING" }
      });
      if (response.status === "processed") {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      }
    } catch {
      await prisma.refund.update({ where: { id: result.refund.id }, data: { status: "NEEDS_REVIEW" } });
    }
  }
  const refund = result.refund || await prisma.refund.findFirst({ where: { bookingId } });
  return { status: "CANCELLED", refundStatus: refund?.status || "NOT_REQUIRED" };
}
