import type { Metadata } from "next";
import Link from "next/link";
import { BookingSearch } from "@/components/booking-search";
import { RoomCard } from "@/components/room-card";
import { SectionHeading } from "@/components/section-heading";
import { prisma } from "@/lib/prisma";
import { searchAvailableRooms } from "@/lib/inventory";

export const metadata: Metadata = { title: "Rooms & Suites" };

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const checkIn = typeof query.checkIn === "string" ? query.checkIn : "";
  const checkOut = typeof query.checkOut === "string" ? query.checkOut : "";
  const guests = Math.max(1, Math.min(12, Number(query.guests) || 2));
  const rooms = Math.max(1, Math.min(4, Number(query.rooms) || 1));
  let results: Awaited<ReturnType<typeof searchAvailableRooms>>["available"] | null = null;
  let message = "";
  if (checkIn && checkOut) {
    try {
      results = (await searchAvailableRooms(checkIn, checkOut, guests, rooms)).available;
    } catch (error) {
      message = error instanceof Error && error.message.startsWith("Choose valid") ? error.message : "Availability is temporarily unavailable. Please try again.";
    }
  } else {
    try {
      const listed = await prisma.roomType.findMany({ where: { active: true }, orderBy: { basePrice: "asc" } });
      results = listed.map((roomType) => ({ roomType, quote: { nights: 0, subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0 } }));
    } catch {
      message = "Our room information is temporarily unavailable.";
    }
  }
  return (
    <>
      <section className="content-hero"><p className="eyebrow">Stay a little longer</p><h1>Room to settle into.</h1><p>Each stay is a considered retreat, with natural textures, generous light and details already taken care of.</p></section>
      <section className="rooms-search-section">
        <BookingSearch checkIn={checkIn} checkOut={checkOut} guests={guests} rooms={rooms} />
      </section>
      <section className="section rooms-results">
        <SectionHeading eyebrow={checkIn ? "Your selected dates" : "Find your place"} title={checkIn ? "Spaces available for your stay" : "A room for your kind of escape"} copy={checkIn ? "Prices include taxes and any selected offer will be applied securely at checkout." : "Choose your dates to check live availability and see your total."} />
        {message && <div className="empty-state"><p>{message}</p><Link className="text-link" href="/contact">Speak with our team ↗</Link></div>}
        {results?.length ? <div className="room-grid">{results.map(({ roomType, quote }) => {
          const bookingHref = checkIn && checkOut
            ? "/booking?roomType=" + encodeURIComponent(roomType.slug) + "&checkIn=" + encodeURIComponent(checkIn) + "&checkOut=" + encodeURIComponent(checkOut) + "&guests=" + guests + "&rooms=" + rooms
            : "/rooms/" + roomType.slug;
          return <RoomCard key={roomType.id} room={roomType} quote={checkIn ? quote : undefined} bookingHref={bookingHref} />;
        })}</div> : !message ? <div className="empty-state"><p>No rooms match those dates and guest details. Try a different search or contact our team.</p><Link className="text-link" href="/contact">Ask about your dates ↗</Link></div> : null}
      </section>
    </>
  );
}
