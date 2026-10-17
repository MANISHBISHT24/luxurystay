import { prisma } from "@/lib/prisma";
import { AdminBookingActions } from "@/components/admin-controls";
import { formatDateOnly } from "@/lib/hotel-time";

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    include: {
      roomType: true,
      guests: { where: { isPrimary: true }, take: 1 },
      payments: true,
      refunds: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return <section className="admin-page"><p className="eyebrow">Guest reservations</p><h1 className="page-title">Bookings</h1><p className="section-copy">Most recent 200 reservations, payment states and refunds.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guest / reference</th><th>Room &amp; dates</th><th>Status</th><th>Payment / refund</th><th>Total</th><th>Manage</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td>{booking.guests[0]?.fullName || "Guest"}<small>{booking.guests[0]?.email || "—"}</small><small>{booking.reference}</small></td><td>{booking.roomType.name}<small>{formatDateOnly(booking.checkIn)} – {formatDateOnly(booking.checkOut)}</small><small>{booking.roomCount} room(s)</small></td><td><span className="status-pill">{booking.status}</span></td><td>{booking.payments.map((payment) => <small key={payment.id}>Payment {payment.status}</small>)}{booking.refunds.map((refund) => <small key={refund.id}>Refund {refund.status}</small>)}</td><td>₹{booking.total.toNumber().toLocaleString("en-IN")}</td><td><AdminBookingActions id={booking.id} status={booking.status} /></td></tr>)}</tbody></table>{bookings.length === 0 && <p className="admin-empty">No reservations yet.</p>}</div></section>;
}
