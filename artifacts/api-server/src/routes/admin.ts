import { Router, type IRouter } from "express";
import { count, desc, eq } from "drizzle-orm";
import {
  GetAdminOverviewResponse,
  ListAdminBookingsQueryParams,
  ListAdminBookingsResponse,
} from "@workspace/api-zod";
import {
  bookingGuestsTable,
  bookingsTable,
  db,
  hotelsTable,
  roomTypesTable,
} from "@workspace/db";
import { requireAdministrator } from "../lib/auth";

const router: IRouter = Router();
const pageSize = 25;

function nightsBetween(checkIn: string, checkOut: string): number {
  return (
    (new Date(`${checkOut}T00:00:00.000Z`).getTime() -
      new Date(`${checkIn}T00:00:00.000Z`).getTime()) /
    (24 * 60 * 60 * 1000)
  );
}

function toBookingDto(row: {
  booking: typeof bookingsTable.$inferSelect;
  roomName: string;
  guestName: string;
  guestEmail: string;
}) {
  return {
    id: row.booking.id,
    reference: row.booking.reference,
    status: row.booking.status,
    roomTypeId: row.booking.roomTypeId,
    roomName: row.roomName,
    checkIn: new Date(`${row.booking.checkIn}T00:00:00.000Z`),
    checkOut: new Date(`${row.booking.checkOut}T00:00:00.000Z`),
    nights: nightsBetween(row.booking.checkIn, row.booking.checkOut),
    rooms: row.booking.rooms,
    adults: row.booking.adults,
    children: row.booking.children,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    subtotalAmount: row.booking.subtotalMinor,
    taxAmount: row.booking.taxMinor,
    serviceFeeAmount: row.booking.serviceFeeMinor,
    totalAmount: row.booking.totalMinor,
    currency: row.booking.currency,
    paymentStatus: row.booking.paymentStatus,
    holdExpiresAt: row.booking.holdExpiresAt,
    createdAt: row.booking.createdAt,
  };
}

router.get(
  "/admin/overview",
  requireAdministrator,
  async (_req, res): Promise<void> => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const now = new Date();
    const [allBookings, roomTypes, hotel] = await Promise.all([
      db.select().from(bookingsTable),
      db.select().from(roomTypesTable),
      db.select().from(hotelsTable).limit(1),
    ]);
    const activePending = allBookings.filter(
      (booking) =>
        booking.status === "PENDING_PAYMENT" &&
        booking.holdExpiresAt !== null &&
        booking.holdExpiresAt > now,
    );
    const confirmed = allBookings.filter(
      (booking) => booking.status === "CONFIRMED",
    );
    const todayBookings = confirmed.filter(
      (booking) => booking.checkIn <= today && booking.checkOut > today,
    );
    const totalUnits = roomTypes.reduce(
      (sum, roomType) => sum + roomType.inventory,
      0,
    );
    const occupiedUnits = todayBookings.reduce(
      (sum, booking) => sum + booking.rooms,
      0,
    );
    const paidTotal = confirmed
      .filter((booking) => booking.paymentStatus === "PAID")
      .reduce((sum, booking) => sum + booking.totalMinor, 0);
    const recent = await db
      .select({
        booking: bookingsTable,
        roomName: roomTypesTable.name,
        guestName: bookingGuestsTable.name,
        guestEmail: bookingGuestsTable.email,
      })
      .from(bookingsTable)
      .innerJoin(roomTypesTable, eq(bookingsTable.roomTypeId, roomTypesTable.id))
      .innerJoin(
        bookingGuestsTable,
        eq(bookingGuestsTable.bookingId, bookingsTable.id),
      )
      .orderBy(desc(bookingsTable.createdAt))
      .limit(5);

    res.json(
      GetAdminOverviewResponse.parse({
        totalBookings: allBookings.length,
        pendingBookings: activePending.length,
        confirmedBookings: confirmed.length,
        occupancyPercent:
          totalUnits === 0
            ? 0
            : Math.round((occupiedUnits / totalUnits) * 10000) / 100,
        grossRevenue: paidTotal,
        currency: hotel[0]?.currency ?? "INR",
        recentBookings: recent.map((row) => toBookingDto(row)),
      }),
    );
  },
);

router.get(
  "/admin/bookings",
  requireAdministrator,
  async (req, res): Promise<void> => {
    const params = ListAdminBookingsQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: "Booking filters are invalid." });
      return;
    }
    const page = params.data.page ?? 1;
    if (page > 10000) {
      res.status(400).json({ error: "Page number is too large." });
      return;
    }

    const filter =
      params.data.status !== undefined
        ? eq(bookingsTable.status, params.data.status)
        : undefined;
    const [countRow, rows] = await Promise.all([
      db.select({ total: count() }).from(bookingsTable).where(filter),
      db
        .select({
          booking: bookingsTable,
          roomName: roomTypesTable.name,
          guestName: bookingGuestsTable.name,
          guestEmail: bookingGuestsTable.email,
        })
        .from(bookingsTable)
        .innerJoin(roomTypesTable, eq(bookingsTable.roomTypeId, roomTypesTable.id))
        .innerJoin(
          bookingGuestsTable,
          eq(bookingGuestsTable.bookingId, bookingsTable.id),
        )
        .where(filter)
        .orderBy(desc(bookingsTable.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);
    res.json(
      ListAdminBookingsResponse.parse({
        items: rows.map((row) => toBookingDto(row)),
        page,
        pageSize,
        total: countRow[0]?.total ?? 0,
      }),
    );
  },
);

export default router;
