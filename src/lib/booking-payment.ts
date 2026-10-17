import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/payments";
import { sendEmail } from "@/lib/email";

export async function processCapturedPayment(orderId: string, paymentId: string, amountPaise: number) {
  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { orderId },
      include: { booking: { include: { roomType: true, guests: { where: { isPrimary: true }, take: 1 }, rooms: true } } }
    });
    if (!payment || amountPaise <= 0) throw new Error("Payment does not match the stored order.");
    if (payment.status === "CAPTURED") {
      if (payment.paymentId === paymentId) {
        return { result: "already" as const, guest: null, reference: payment.booking.reference };
      }
      return createRefund(tx, payment, payment.booking, paymentId, amountPaise, "duplicate-payment-refund:" + paymentId);
    }
    const booking = payment.booking;
    const expectedAmountPaise = Math.round(payment.amount.toNumber() * 100);
    const now = new Date();
    const conflicts = await tx.bookingRoom.count({
      where: {
        roomId: { in: booking.rooms.map((row) => row.roomId) },
        bookingId: { not: booking.id },
        booking: {
          checkIn: { lt: booking.checkOut },
          checkOut: { gt: booking.checkIn },
          OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: now } }]
        }
      }
    });
    const canConfirm = booking.status === "PENDING" && booking.expiresAt > now && conflicts === 0;
    await tx.payment.update({
      where: { id: payment.id },
      data: { paymentId, status: "CAPTURED" }
    });
    if (expectedAmountPaise !== amountPaise) {
      return createRefund(tx, payment, booking, paymentId, amountPaise, "mismatched-payment-refund:" + paymentId);
    }
    if (canConfirm) {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
      await tx.auditLog.create({
        data: { action: "BOOKING_CONFIRMED", entity: "Booking", entityId: booking.id, details: { paymentId } }
      });
      return { result: "confirmed" as const, guest: booking.guests[0] || null, reference: booking.reference };
    }
    if (booking.status === "PENDING") {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
      if (booking.couponId) {
        await tx.coupon.updateMany({ where: { id: booking.couponId, uses: { gt: 0 } }, data: { uses: { decrement: 1 } } });
      }
    }
    return createRefund(tx, payment, booking, paymentId, amountPaise, "late-payment-refund:" + booking.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (outcome.result === "confirmed" && outcome.guest) {
    await sendEmail(outcome.guest.email, "Your LuxuryStay reservation is confirmed", "<p>Your stay is confirmed.</p><p>Reference: " + outcome.reference + "</p>").catch(() => undefined);
  }
  if (outcome.result === "refund") {
    try {
      const response = await razorpay().payments.refund(outcome.paymentId, { amount: outcome.amount });
      await prisma.refund.update({
        where: { id: outcome.refundId },
        data: { providerId: response.id, status: response.status || "PENDING" }
      });
    } catch {
      await prisma.refund.update({ where: { id: outcome.refundId }, data: { status: "NEEDS_REVIEW" } });
    }
  }
  return { result: outcome.result, reference: outcome.reference };
}

async function createRefund(
  tx: Prisma.TransactionClient,
  payment: { id: string },
  booking: { id: string; reference: string },
  providerPaymentId: string,
  amountPaise: number,
  idempotencyKey: string
) {
  const refund = await tx.refund.upsert({
    where: { idempotencyKey },
    create: {
      bookingId: booking.id,
      paymentId: payment.id,
      providerPaymentId,
      idempotencyKey,
      amount: amountPaise / 100
    },
    update: {}
  });
  return { result: "refund" as const, refundId: refund.id, paymentId: providerPaymentId, amount: amountPaise, reference: booking.reference, guest: null };
}
