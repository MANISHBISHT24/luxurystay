import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";
import { createToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";

const requestSchema = z.object({ email: z.email().max(254) });
const completeSchema = z.object({
  email: z.email().max(254),
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(10).max(128)
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "password-reset", 5, 600_000)) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
    const body = await request.json().catch(() => null);
    const complete = completeSchema.safeParse(body);
    if (complete.success) {
      const email = complete.data.email.toLowerCase();
      const identifier = "reset:" + email;
      const record = await prisma.verificationToken.findFirst({
        where: { identifier, token: hashToken(complete.data.token), expires: { gt: new Date() } }
      });
      if (!record) return NextResponse.json({ error: "That reset link is invalid or has expired." }, { status: 400 });
      await prisma.$transaction([
        prisma.user.update({
          where: { email },
          data: { passwordHash: await hash(complete.data.password, 12), sessionVersion: { increment: 1 } }
        }),
        prisma.verificationToken.deleteMany({ where: { identifier } })
      ]);
      return NextResponse.json({ reset: true });
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
      return NextResponse.json({ error: "Password reset email is not configured. Please contact the resort." }, { status: 503 });
    }
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const identifier = "reset:" + email;
      const token = createToken();
      await prisma.verificationToken.deleteMany({ where: { identifier } });
      await prisma.verificationToken.create({
        data: { identifier, token: token.hash, expires: new Date(Date.now() + 60 * 60_000) }
      });
      const url = new URL("/password-reset?email=" + encodeURIComponent(email) + "&token=" + token.token, process.env.AUTH_URL || request.url);
      try {
        await sendEmail(email, "Reset your LuxuryStay password", "<p>Choose a new password using this secure link:</p><p><a href=\"" + url.toString() + "\">Reset my password</a></p>");
      } catch {
        await prisma.verificationToken.deleteMany({ where: { identifier } });
        return NextResponse.json({ error: "Password reset email is temporarily unavailable." }, { status: 503 });
      }
    }
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 });
  }
}
