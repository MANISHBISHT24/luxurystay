import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/authz";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";
import { cancelBooking } from "@/lib/cancel-booking";
import { HttpError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    if (!await consumeRateLimit(request, "cancel", 5, 60_000)) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in to manage this reservation." }, { status: 401 });
    const { reference } = await params;
    const booking = await prisma.booking.findUnique({ where: { reference }, select: { id: true, userId: true } });
    if (!booking || booking.userId !== user.id) return NextResponse.json({ error: "Reservation was not found." }, { status: 404 });
    return NextResponse.json(await cancelBooking(booking.id, user.id, true));
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Cancellation is temporarily unavailable." }, { status: 503 });
  }
}
