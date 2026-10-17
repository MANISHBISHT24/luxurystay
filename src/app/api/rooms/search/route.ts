import { NextResponse } from "next/server";
import { z } from "zod";
import { searchAvailableRooms } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().int().min(1).max(12).default(2),
  rooms: z.coerce.number().int().min(1).max(4).default(1)
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Choose valid dates and guest counts." }, { status: 400 });
  try {
    const result = await searchAvailableRooms(query.data.checkIn, query.data.checkOut, query.data.guests, query.data.rooms);
    return NextResponse.json({ checkIn: query.data.checkIn, checkOut: query.data.checkOut, rooms: query.data.rooms, guests: query.data.guests, available: result.available });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Choose valid")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Choose valid dates")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Room availability is temporarily unavailable." }, { status: 503 });
  }
}
