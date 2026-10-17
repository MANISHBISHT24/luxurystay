import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const { id } = await params;
    const message = await prisma.contactMessage.update({ where: { id }, data: { readAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "CONTACT_MESSAGE_READ", entity: "ContactMessage", entityId: id } });
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Contact message was not found." }, { status: 404 });
  }
}
