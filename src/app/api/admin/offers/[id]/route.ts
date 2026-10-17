import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid offer status." }, { status: 400 });
  try {
    const { id } = await params;
    const offer = await prisma.coupon.update({ where: { id }, data: parsed.data });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "OFFER_UPDATED", entity: "Coupon", entityId: id } });
    return NextResponse.json({ offer });
  } catch {
    return NextResponse.json({ error: "Offer was not found." }, { status: 404 });
  }
}
