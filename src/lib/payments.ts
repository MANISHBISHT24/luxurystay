import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";

export function paymentReady() {
  const key = process.env.RAZORPAY_KEY_ID;
  return Boolean(key && (key.startsWith("rzp_test_") || key.startsWith("rzp_live_")) && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpay() {
  if (!paymentReady()) throw new Error("Online payment is not configured.");
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!
  });
}

export async function createPaymentOrder(booking: { id: string; reference: string; total: { toNumber(): number } }) {
  const idempotencyKey = "booking-order:" + booking.reference;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", idempotencyKey);
    const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (existing?.orderId) {
      return { orderId: existing.orderId, amount: Math.round(existing.amount.toNumber() * 100), currency: existing.currency };
    }
    const amount = Math.round(booking.total.toNumber() * 100);
    const order = await razorpay().orders.create({ amount, currency: "INR", receipt: booking.reference });
    const payment = await tx.payment.upsert({
      where: { idempotencyKey },
      create: { bookingId: booking.id, orderId: order.id, amount: booking.total.toNumber(), currency: "INR", idempotencyKey },
      update: { orderId: order.id, status: "PENDING" }
    });
    return { orderId: payment.orderId!, amount, currency: payment.currency };
  }, { timeout: 20_000 });
}
