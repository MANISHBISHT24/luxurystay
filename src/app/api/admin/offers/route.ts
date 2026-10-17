import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().finite().positive(),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  maxUses: z.coerce.number().int().positive().max(1_000_000).optional()
});

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    return NextResponse.json({ offers: await prisma.coupon.findMany({ orderBy: { code: "asc" } }) });
  } catch {
    return NextResponse.json({ error: "Offers are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.kind === "PERCENT" && parsed.data.value > 100)) {
    return NextResponse.json({ error: "Enter a valid offer code and discount." }, { status: 400 });
  }
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) {
    return NextResponse.json({ error: "Offer dates are invalid." }, { status: 400 });
  }
  try {
    const offer = await prisma.coupon.create({
      data: {
        code: parsed.data.code,
        kind: parsed.data.kind,
        value: parsed.data.value,
        startsAt,
        endsAt,
        maxUses: parsed.data.maxUses
      }
    });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "OFFER_CREATED", entity: "Coupon", entityId: offer.id } });
    return NextResponse.json({ offer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That offer code already exists or could not be saved." }, { status: 409 });
  }
}
