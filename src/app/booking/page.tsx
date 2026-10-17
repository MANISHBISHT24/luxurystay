import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingSearch } from "@/components/booking-search";
import { BookingForm } from "@/components/booking-form";
import { prisma } from "@/lib/prisma";
import { availablePhysicalRooms, parseStay, quoteForRoom } from "@/lib/inventory";
import { paymentReady } from "@/lib/payments";
import { headers } from "next/headers";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "Secure your stay" };

export default async function BookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [query, requestHeaders, session] = await Promise.all([searchParams, headers(), auth()]);
  const roomSlug = typeof query.roomType === "string" ? query.roomType : "";
  const room = roomSlug ? await prisma.roomType.findUnique({ where: { slug: roomSlug, active: true } }).catch(() => null) : null;
  if (roomSlug && !room) notFound();
  const checkIn = typeof query.checkIn === "string" ? query.checkIn : "";
  const checkOut = typeof query.checkOut === "string" ? query.checkOut : "";
  const guests = Math.max(1, Math.min(room?.maxGuests || 12, Number(query.guests) || 2));
  const roomCount = Math.max(1, Math.min(4, Number(query.rooms) || 1));
  let quote: Awaited<ReturnType<typeof quoteForRoom>>["price"] | null = null;
  let problem = "";
  if (room && checkIn && checkOut) {
    try {
      const settings = await prisma.hotelSetting.findUnique({ where: { id: 1 }, select: { timezone: true } });
      const dates = parseStay(checkIn, checkOut, settings?.timezone);
      const inventory = await prisma.$transaction((tx) => availablePhysicalRooms(tx, room.id, dates.checkIn, dates.checkOut, roomCount));
      if (inventory.length !== roomCount) problem = "Those dates are no longer available. Please choose another stay.";
      else {
        const result = await quoteForRoom({ client: prisma, roomTypeId: room.id, checkIn: dates.checkIn, checkOut: dates.checkOut, roomCount });
        quote = result.price;
      }
    } catch (error) {
      problem = error instanceof Error ? error.message : "Please choose valid dates.";
    }
  }
  return (
    <section className="form-page booking-page">
      <p className="eyebrow">Your time away</p>
      <h1 className="page-title">Make it yours.</h1>
      <p className="section-copy">Your rate and availability are checked again on the server before a reservation is held.</p>
      {!room && <div className="empty-state"><p>Choose the room that feels right for you.</p><Link className="text-link" href="/rooms">Browse rooms ↗</Link></div>}
      {room && (!checkIn || !checkOut) && <div className="booking-dates"><h2>{room.name}</h2><p>Choose your dates to see availability and the current total.</p><BookingSearch action="/booking" roomType={room.slug} /></div>}
      {room && checkIn && checkOut && <div className="booking-layout">
        <div className="booking-summary"><h2>{room.name}</h2><p>{checkIn} — {checkOut}</p><p>{guests} guests · {roomCount} {roomCount === 1 ? "room" : "rooms"}</p>{quote ? <div className="quote-breakdown"><span>{quote.nights} nights</span><span>Room total ₹{quote.subtotal.toLocaleString("en-IN")}</span><span>Taxes ₹{quote.taxAmount.toLocaleString("en-IN")}</span><strong>Total ₹{quote.total.toLocaleString("en-IN")}</strong></div> : <p className="form-message">{problem || "We could not quote those dates. Please change your search."}</p>}<BookingSearch action="/booking" roomType={room.slug} checkIn={checkIn} checkOut={checkOut} guests={guests} rooms={roomCount} /></div>
        {quote && !session?.user?.id ? <div className="form-card sign-in-notice"><h2>Sign in to reserve</h2><p>Your reservation and cancellation options are kept with your account.</p><Link className="button button-dark" href="/login">Sign in or create an account</Link></div> : null}
        {quote && session?.user?.id ? <BookingForm roomType={room.slug} roomName={room.name} checkIn={checkIn} checkOut={checkOut} guests={guests} roomCount={roomCount} paymentEnabled={paymentReady()} nonce={requestHeaders.get("x-nonce") || ""} /> : null}
      </div>}
    </section>
  );
}
