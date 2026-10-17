import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json({ error: "Customer records are temporarily unavailable." }, { status: 503 });
  }
}
