import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

const schema = z.object({
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nightlyRate: z.coerce.number().finite().min(1).max(10_000_000)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid seasonal rate dates and amount." }, { status: 400 });
  const startsOn = new Date(parsed.data.startsOn + "T00:00:00.000Z");
  const endsOn = new Date(parsed.data.endsOn + "T00:00:00.000Z");
  if (!Number.isFinite(startsOn.getTime()) || !Number.isFinite(endsOn.getTime()) || endsOn <= startsOn) {
    return NextResponse.json({ error: "Seasonal rate end date must follow its start date." }, { status: 400 });
  }
  try {
    const { id } = await params;
    const rate = await prisma.seasonalRate.create({ data: { roomTypeId: id, startsOn, endsOn, nightlyRate: parsed.data.nightlyRate } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "SEASONAL_RATE_CREATED", entity: "SeasonalRate", entityId: rate.id } });
    return NextResponse.json({ rate }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Room type was not found or the rate could not be saved." }, { status: 404 });
  }
}
