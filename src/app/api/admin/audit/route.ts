import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    return NextResponse.json({ entries: await prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    }) });
  } catch {
    return NextResponse.json({ error: "Audit history is temporarily unavailable." }, { status: 503 });
  }
}
