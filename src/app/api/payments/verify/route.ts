import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/payments";
import { processCapturedPayment } from "@/lib/booking-payment";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i)
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "payment-verify", 20, 60_000)) return NextResponse.json({ error: "Please wait before retrying payment verification." }, { status: 429 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !process.env.RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Payment details could not be verified." }, { status: 400 });
    const values = parsed.data;
    const stored = await prisma.payment.findUnique({ where: { orderId: values.razorpay_order_id } });
    if (!stored) return NextResponse.json({ error: "Payment order was not found." }, { status: 404 });
    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(stored.orderId + "|" + values.razorpay_payment_id)
      .digest();
    const supplied = Buffer.from(values.razorpay_signature, "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return NextResponse.json({ error: "Payment signature is invalid." }, { status: 400 });
    }
    const providerPayment = await razorpay().payments.fetch(values.razorpay_payment_id);
    if (providerPayment.order_id !== stored.orderId) return NextResponse.json({ error: "Payment order does not match the reservation." }, { status: 400 });
    if (providerPayment.status !== "captured") {
      return NextResponse.json({ error: "Payment is still processing." }, { status: 202 });
    }
    const result = await processCapturedPayment(stored.orderId, providerPayment.id, Number(providerPayment.amount));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503 });
  }
}
