import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { isSameOrigin, HttpError } from "@/lib/http";
import { cancelBooking } from "@/lib/cancel-booking";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const { id } = await params;
    return NextResponse.json(await cancelBooking(id, admin.id, false));
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Cancellation is temporarily unavailable." }, { status: 503 });
  }
}
