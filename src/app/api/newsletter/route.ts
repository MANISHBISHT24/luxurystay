import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "newsletter", 5, 60_000)) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
    const parsed = z.object({ email: z.email().max(254) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email.toLowerCase() },
      create: { email: parsed.data.email.toLowerCase() },
      update: {}
    });
    return NextResponse.json({ subscribed: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Newsletter signup is temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "newsletter", 5, 60_000)) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
    const parsed = z.object({ email: z.email().max(254) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    await prisma.newsletterSubscriber.deleteMany({
      where: { email: parsed.data.email.toLowerCase() }
    });
    return NextResponse.json({ unsubscribed: true });
  } catch {
    return NextResponse.json({ error: "Unsubscribe is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email || !z.email().safeParse(email).success) {
    return NextResponse.redirect(new URL("/?unsubscribed=0", request.url));
  }
  try {
    await prisma.newsletterSubscriber.deleteMany({
      where: { email: email.toLowerCase() }
    });
    return NextResponse.redirect(new URL("/?unsubscribed=1", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?unsubscribed=0", request.url));
  }
}
