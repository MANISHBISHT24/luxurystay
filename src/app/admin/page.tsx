import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, hotelDate } from "@/lib/hotel-time";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const settings = await prisma.hotelSetting.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const todayText = hotelDate(new Date(), settings?.timezone);
  const today = new Date(todayText + "T00:00:00.000Z");
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [totalBookings, arrivals, departures, totalRooms, occupiedRooms, revenue, recent] = await Promise.all([
    prisma.booking.count({
      where: {
        OR: [
          { status: "CONFIRMED" },
          { status: "PENDING", expiresAt: { gt: new Date() } }
        ]
      }
    }),
    prisma.booking.count({ where: { status: "CONFIRMED", checkIn: today } }),
    prisma.booking.count({ where: { status: "CONFIRMED", checkOut: today } }),
    prisma.room.count(),
    prisma.bookingRoom.count({ where: { booking: { status: "CONFIRMED", checkIn: { lt: tomorrow }, checkOut: { gt: today } } } }),
    prisma.payment.aggregate({ where: { status: "CAPTURED", createdAt: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) } }, _sum: { amount: true } }),
    prisma.booking.findMany({ include: { roomType: true, guests: { where: { isPrimary: true }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 6 })
  ]);
  const occupancy = totalRooms ? Math.round(occupiedRooms / totalRooms * 100) : 0;
  return <section className="admin-page"><p className="eyebrow">Your resort at a glance</p><h1 className="page-title">Good day.</h1><p className="section-copy">Live operations for {todayText}.</p><div className="admin-stat-grid"><article><span>Active bookings</span><strong>{totalBookings}</strong></article><article><span>Arrivals today</span><strong>{arrivals}</strong></article><article><span>Departures today</span><strong>{departures}</strong></article><article><span>Occupancy today</span><strong>{occupancy}%</strong><small>{occupiedRooms} of {totalRooms} rooms</small></article><article><span>Captured revenue this month</span><strong>₹{(revenue._sum.amount?.toNumber() || 0).toLocaleString("en-IN")}</strong></article></div><div className="admin-page-heading"><h2>Recent reservations</h2><Link className="arrow-link" href="/admin/bookings">All bookings ↗</Link></div><div className="admin-booking-list">{recent.map((booking) => <article className="admin-booking-row" key={booking.id}><div><strong>{booking.roomType.name}</strong><small>{booking.guests[0]?.fullName || "Guest"} · {formatDateOnly(booking.checkIn)} – {formatDateOnly(booking.checkOut)}</small></div><span className="status-pill">{booking.status}</span><strong>₹{booking.total.toNumber().toLocaleString("en-IN")}</strong></article>)}</div></section>;
}
