import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";
import { sendEmail } from "@/lib/email";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(3000)
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "contact", 5, 60_000)) return NextResponse.json({ error: "Please wait before sending another message." }, { status: 429 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Please complete all fields with valid details." }, { status: 400 });
    const message = { ...parsed.data, email: parsed.data.email.toLowerCase() };
    await prisma.contactMessage.create({ data: message });
    const recipient = await prisma.hotelSetting.findUnique({ where: { id: 1 }, select: { contactEmail: true } }).catch(() => null);
    if (recipient?.contactEmail && process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      const subject = message.subject.replace(/[\r\n]+/g, " ").slice(0, 120);
      await sendEmail(
        recipient.contactEmail,
        "LuxuryStay enquiry: " + subject,
        "<p>From " + escapeHtml(message.name) + " (" + escapeHtml(message.email) + ")</p><p>" + escapeHtml(message.message).replaceAll("\n", "<br>") + "</p>"
      ).catch(() => undefined);
    }
    return NextResponse.json({ sent: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "We could not save your message. Please try again." }, { status: 503 });
  }
}
