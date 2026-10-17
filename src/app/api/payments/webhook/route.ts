import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCapturedPayment } from "@/lib/booking-payment";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-razorpay-signature") || "";
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 1_000_000) return NextResponse.json({ error: "Webhook is too large." }, { status: 413 });
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  try {
    const event = JSON.parse(body) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
        refund?: { entity?: { id?: string; payment_id?: string; status?: string } };
      };
    };
    const payment = event.payload?.payment?.entity;
    if (event.event === "payment.captured" && payment?.id && payment.order_id && typeof payment.amount === "number") {
      await processCapturedPayment(payment.order_id, payment.id, payment.amount);
    } else if (event.event === "payment.failed" && payment?.order_id) {
      await prisma.payment.updateMany({
        where: { orderId: payment.order_id, status: { in: ["PENDING", "AUTHORIZED"] } },
        data: { status: "FAILED" }
      });
    } else if (event.event === "refund.processed" && event.payload?.refund?.entity?.id) {
      const providerId = event.payload.refund.entity.id;
      const providerPaymentId = event.payload.refund.entity.payment_id;
      const refund = await prisma.refund.findUnique({ where: { providerId } }) ||
        (providerPaymentId ? await prisma.refund.findFirst({ where: { providerPaymentId, status: "PENDING" } }) : null);
      if (refund) {
        await prisma.refund.update({ where: { id: refund.id }, data: { providerId, status: "processed" } });
        await prisma.payment.update({ where: { id: refund.paymentId }, data: { status: "REFUNDED" } });
      }
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 503 });
  }
}
