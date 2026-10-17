import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const status = z.enum(["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"]).safeParse(new URL(request.url).searchParams.get("status"));
  try {
    const bookings = await prisma.booking.findMany({
      where: status.success ? { status: status.data } : undefined,
      include: {
        roomType: true,
        guests: { where: { isPrimary: true }, take: 1 },
        payments: { select: { status: true, amount: true, paymentId: true } },
        refunds: { select: { status: true, amount: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return NextResponse.json({ bookings });
  } catch {
    return NextResponse.json({ error: "Bookings are temporarily unavailable." }, { status: 503 });
  }
}
