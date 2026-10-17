import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

const roomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  description: z.string().trim().min(20).max(2000),
  maxGuests: z.coerce.number().int().min(1).max(12),
  bedSummary: z.string().trim().min(2).max(100),
  areaSqm: z.coerce.number().int().min(8).max(2000),
  basePrice: z.coerce.number().finite().min(1).max(10_000_000),
  imageUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
  inventory: z.coerce.number().int().min(1).max(100),
  featured: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true)
});

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const rooms = await prisma.roomType.findMany({ include: { _count: { select: { rooms: true } }, seasonalRates: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ rooms });
  } catch {
    return NextResponse.json({ error: "Room inventory is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid room and inventory details." }, { status: 400 });
  try {
    const { inventory, ...roomData } = parsed.data;
    const room = await prisma.$transaction(async (tx) => {
      const saved = await tx.roomType.create({ data: { ...roomData } });
      const prefix = saved.slug.slice(0, 3).toUpperCase();
      await tx.room.createMany({
        data: Array.from({ length: inventory }, (_, index) => ({
          typeId: saved.id,
          number: prefix + "-" + randomBytes(4).toString("hex").toUpperCase() + "-" + (index + 1)
        }))
      });
      await tx.auditLog.create({ data: { userId: admin.id, action: "ROOM_CREATED", entity: "RoomType", entityId: saved.id } });
      return saved;
    });
    return NextResponse.json({ room }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A room type with that slug may already exist." }, { status: 409 });
  }
}
