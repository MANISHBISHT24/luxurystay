import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/hotel-time";

export const metadata: Metadata = { title: "Your reservation" };

export default async function BookingConfirmation({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!/^[A-F0-9]{32}$/.test(reference)) notFound();
  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { roomType: true, guests: { where: { isPrimary: true }, take: 1 }, payments: true }
  }).catch(() => null);
  if (!booking) notFound();
  const status = booking.status === "PENDING" && booking.expiresAt <= new Date() ? "EXPIRED" : booking.status;
  const confirmed = status === "CONFIRMED";
  return <section className="empty-page reservation-result"><p className="eyebrow">{confirmed ? "It is all yours" : "Reservation status"}</p><h1>{confirmed ? "We look forward to welcoming you." : status === "PENDING" ? "Your room is on hold." : status === "EXPIRED" ? "This hold has expired." : "Your reservation was cancelled."}</h1><p>{confirmed ? "Your payment has been verified and your stay is confirmed." : status === "PENDING" ? "Payment has not been verified yet. Your room is held for a short time while payment completes." : "You can search again to choose a new stay."}</p><div className="confirmation-card"><span>Reference</span><strong>{booking.reference}</strong><span>Stay</span><strong>{booking.roomType.name} · {formatDateOnly(booking.checkIn)} to {formatDateOnly(booking.checkOut)}</strong><span>Guests</span><strong>{booking.adults + booking.children} · ₹{booking.total.toNumber().toLocaleString("en-IN")}</strong><span>Status</span><strong>{status}</strong></div><Link className="button button-dark" href="/rooms">Explore another stay</Link></section>;
}
