import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  currency: z.literal("INR"),
  timezone: z.string().min(3).max(80),
  taxPercent: z.coerce.number().min(0).max(50),
  cancellationHours: z.coerce.number().int().min(0).max(720),
  contactEmail: z.email().max(254).optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(500).optional()
});

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    return NextResponse.json({ settings: await prisma.hotelSetting.findUnique({ where: { id: 1 } }) });
  } catch {
    return NextResponse.json({ error: "Hotel settings are temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid resort settings." }, { status: 400 });
  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone });
  } catch {
    return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 });
  }
  try {
    const settings = await prisma.hotelSetting.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data }
    });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "HOTEL_SETTINGS_UPDATED", entity: "HotelSetting", entityId: "1" } });
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Hotel settings could not be saved." }, { status: 503 });
  }
}
