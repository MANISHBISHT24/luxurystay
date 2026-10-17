import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(20).max(2000).optional(),
  maxGuests: z.coerce.number().int().min(1).max(12).optional(),
  bedSummary: z.string().trim().min(2).max(100).optional(),
  areaSqm: z.coerce.number().int().min(8).max(2000).optional(),
  basePrice: z.coerce.number().finite().min(1).max(10_000_000).optional(),
  imageUrl: z.url().refine((value) => new URL(value).protocol === "https:").optional(),
  featured: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional()
}).refine((data) => Object.keys(data).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid room details." }, { status: 400 });
  try {
    const { id } = await params;
    const room = await prisma.roomType.update({ where: { id }, data: parsed.data });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "ROOM_UPDATED", entity: "RoomType", entityId: id } });
    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: "Room was not found or could not be updated." }, { status: 404 });
  }
}
