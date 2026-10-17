import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createToken } from "@/lib/tokens";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  password: z.string().min(10).max(128)
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
  if (!await consumeRateLimit(request, "register", 5, 600_000)) return NextResponse.json({ error: "Please wait before creating another account." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, email and password of at least 10 characters." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
  }
  const requireVerification = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hash(parsed.data.password, 12),
      emailVerified: requireVerification ? null : new Date()
    }
  });
  if (requireVerification) {
    const token = createToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await prisma.verificationToken.create({ data: { identifier: user.email, token: token.hash, expires } });
    const url = new URL("/api/auth/verify?token=" + token.token, process.env.AUTH_URL || request.url);
    try {
      await sendEmail(user.email, "Verify your LuxuryStay account", "<p>Confirm your email to complete your account.</p><p><a href=\"" + url.toString() + "\">Verify my email</a></p>");
    } catch {
      await prisma.$transaction([
        prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
        prisma.user.delete({ where: { id: user.id } })
      ]);
      return NextResponse.json({ error: "Email verification is temporarily unavailable. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ verificationRequired: true }, { status: 201 });
  }
  return NextResponse.json({ verificationRequired: false }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Registration is temporarily unavailable." }, { status: 503 });
  }
}
