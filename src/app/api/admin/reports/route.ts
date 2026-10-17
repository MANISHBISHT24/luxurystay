import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function csv(value: string | number) {
  return "\"" + String(value).replaceAll("\"", "\"\"") + "\"";
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const bookings = await prisma.booking.findMany({
      include: { roomType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10_000
    });
    const lines = [
      ["Reference", "Room", "Check in", "Check out", "Status", "Subtotal", "Tax", "Discount", "Total"].map(csv).join(","),
      ...bookings.map((booking) => [
        booking.reference,
        booking.roomType.name,
        booking.checkIn.toISOString().slice(0, 10),
        booking.checkOut.toISOString().slice(0, 10),
        booking.status,
        booking.subtotal.toString(),
        booking.taxAmount.toString(),
        booking.discountAmount.toString(),
        booking.total.toString()
      ].map(csv).join(","))
    ];
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"luxurystay-bookings.csv\"",
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "The report is temporarily unavailable." }, { status: 503 });
  }
}
