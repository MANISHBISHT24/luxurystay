import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  CancelBookingParams,
  CancelBookingResponse,
  CreateBookingBody,
  CreateBookingResponse,
  GetBookingParams,
  GetBookingResponse,
  ListMyBookingsResponse,
} from "@workspace/api-zod";
import {
  bookingGuestsTable,
  bookingsTable,
  db,
  hotelsTable,
  roomInventoryTable,
  roomTypesTable,
  seasonalRatesTable,
} from "@workspace/db";
import { requireSignedIn } from "../lib/auth";
import { bookingRateLimit } from "../lib/rateLimits";

const router: IRouter = Router();
const dayMilliseconds = 24 * 60 * 60 * 1000;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return (
    (new Date(`${checkOut}T00:00:00.000Z`).getTime() -
      new Date(`${checkIn}T00:00:00.000Z`).getTime()) /
    dayMilliseconds
  );
}

function listNights(checkIn: string, checkOut: string): string[] {
  const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  const nights: string[] = [];
  for (let day = start; day < end; day += dayMilliseconds) {
    nights.push(new Date(day).toISOString().slice(0, 10));
  }
  return nights;
}

function asBookingResponse(
  row: {
    booking: typeof bookingsTable.$inferSelect;
    roomName: string;
    guestName: string;
    guestEmail: string;
  },
) {
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

async function loadUserBooking(clerkUserId: string, bookingId: string) {
  const [row] = await db
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
    .where(
      and(
        eq(bookingsTable.id, bookingId),
        eq(bookingsTable.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  return row;
}

router.post(
  "/bookings",
  bookingRateLimit,
  requireSignedIn,
  async (req, res): Promise<void> => {
    const body = CreateBookingBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Booking details are invalid." });
      return;
    }
    const data = body.data;
    const checkIn = dateOnly(data.checkIn);
    const checkOut = dateOnly(data.checkOut);
    const nights = nightsBetween(checkIn, checkOut);
    const todayInIndia = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (
      !Number.isInteger(nights) ||
      nights < 1 ||
      nights > 30 ||
      checkIn < todayInIndia
    ) {
      res.status(400).json({
        error: "Choose a future check-in date and a stay of 1 to 30 nights.",
      });
      return;
    }

    const clerkUserId = res.locals.clerkUserId as string;
    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const identityLock = `${clerkUserId}:${data.idempotencyKey}`;
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${identityLock}))`,
      );
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${data.roomTypeId}))`,
      );

      const [previous] = await tx
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.clerkUserId, clerkUserId),
            eq(bookingsTable.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1);
      if (previous) {
        return { bookingId: previous.id };
      }

      await tx
        .update(bookingsTable)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(
          and(
            eq(bookingsTable.roomTypeId, data.roomTypeId),
            eq(bookingsTable.status, "PENDING_PAYMENT"),
            lt(bookingsTable.holdExpiresAt, now),
          ),
        );

      const [room] = await tx
        .select()
        .from(roomTypesTable)
        .where(
          and(
            eq(roomTypesTable.id, data.roomTypeId),
            eq(roomTypesTable.published, true),
          ),
        )
        .limit(1);
      if (!room) return { error: "Room type was not found." as const };
      if ((data.adults + data.children) > room.maxGuests * data.rooms) {
        return {
          error: "The selected rooms do not have enough guest capacity." as const,
        };
      }

      const [hotel] = await tx.select().from(hotelsTable).limit(1);
      if (!hotel) return { error: "Hotel pricing is not configured." as const };

      const [reservations, inventoryRows, seasonalRates] = await Promise.all([
        tx
          .select({
            checkIn: bookingsTable.checkIn,
            checkOut: bookingsTable.checkOut,
            rooms: bookingsTable.rooms,
          })
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.roomTypeId, room.id),
              lt(bookingsTable.checkIn, checkOut),
              gt(bookingsTable.checkOut, checkIn),
              or(
                eq(bookingsTable.status, "CONFIRMED"),
                and(
                  eq(bookingsTable.status, "PENDING_PAYMENT"),
                  gt(bookingsTable.holdExpiresAt, now),
                ),
              ),
            ),
          ),
        tx
          .select({
            inventoryDate: roomInventoryTable.inventoryDate,
            totalUnits: roomInventoryTable.totalUnits,
            blockedUnits: roomInventoryTable.blockedUnits,
          })
          .from(roomInventoryTable)
          .where(
            and(
              eq(roomInventoryTable.roomTypeId, room.id),
              gte(roomInventoryTable.inventoryDate, checkIn),
              lt(roomInventoryTable.inventoryDate, checkOut),
            ),
          ),
        tx
          .select({
            startDate: seasonalRatesTable.startDate,
            endDate: seasonalRatesTable.endDate,
            price: seasonalRatesTable.pricePerNightMinor,
          })
          .from(seasonalRatesTable)
          .where(
            and(
              eq(seasonalRatesTable.roomTypeId, room.id),
              lt(seasonalRatesTable.startDate, checkOut),
              gt(seasonalRatesTable.endDate, checkIn),
            ),
          )
          .orderBy(desc(seasonalRatesTable.startDate)),
      ]);
      const inventoryByDate = new Map(
        inventoryRows.map((item) => [
          item.inventoryDate,
          Math.max(0, item.totalUnits - item.blockedUnits),
        ]),
      );
      const stayNights = listNights(checkIn, checkOut);
      const minimumAvailable = Math.min(
        ...stayNights.map((night) => {
          const reserved = reservations
            .filter(
              (reservation) =>
                reservation.checkIn <= night && reservation.checkOut > night,
            )
            .reduce((sum, reservation) => sum + reservation.rooms, 0);
          return (inventoryByDate.get(night) ?? room.inventory) - reserved;
        }),
      );
      if (minimumAvailable < data.rooms) {
        return {
          error: "That room availability has changed. Please search again." as const,
        };
      }

      const nightlyTotal = stayNights.reduce((sum, night) => {
        const activeRate = seasonalRates.find(
          (rate) => rate.startDate <= night && rate.endDate > night,
        );
        return sum + (activeRate?.price ?? room.basePriceMinor);
      }, 0);
      const subtotalMinor = nightlyTotal * data.rooms;
      const taxMinor = Math.floor(
        (subtotalMinor * hotel.taxRateBps + 5000) / 10000,
      );
      const serviceFeeMinor = hotel.serviceFeeMinor;
      const totalMinor = subtotalMinor + taxMinor + serviceFeeMinor;
      if (![subtotalMinor, taxMinor, totalMinor].every(Number.isSafeInteger)) {
        return { error: "The booking total is outside the supported range." as const };
      }

      const reference = `SRN-${randomBytes(4).toString("hex").toUpperCase()}`;
      const [booking] = await tx
        .insert(bookingsTable)
        .values({
          reference,
          clerkUserId,
          roomTypeId: room.id,
          checkIn,
          checkOut,
          rooms: data.rooms,
          adults: data.adults,
          children: data.children,
          status: "PENDING_PAYMENT",
          paymentStatus: "NOT_STARTED",
          currency: hotel.currency,
          subtotalMinor,
          taxMinor,
          serviceFeeMinor,
          totalMinor,
          idempotencyKey: data.idempotencyKey,
          holdExpiresAt,
        })
        .returning();
      await tx.insert(bookingGuestsTable).values({
        bookingId: booking.id,
        name: data.guestName,
        email: data.guestEmail,
        phone: data.guestPhone,
        specialRequests: data.specialRequests ?? "",
      });
      return { bookingId: booking.id };
    });

    if (result.error) {
      const status = result.error.includes("availability") ? 409 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    const row = await loadUserBooking(clerkUserId, result.bookingId);
    if (!row) {
      res.status(500).json({ error: "The booking could not be retrieved." });
      return;
    }
    res.status(201).json(CreateBookingResponse.parse(asBookingResponse(row)));
  },
);

router.get(
  "/bookings/me",
  requireSignedIn,
  async (_req, res): Promise<void> => {
    const clerkUserId = res.locals.clerkUserId as string;
    const rows = await db
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
      .where(eq(bookingsTable.clerkUserId, clerkUserId))
      .orderBy(sql`${bookingsTable.createdAt} desc`);
    res.json(
      ListMyBookingsResponse.parse(rows.map((row) => asBookingResponse(row))),
    );
  },
);

router.get(
  "/bookings/:bookingId",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const params = GetBookingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Booking identifier is invalid." });
      return;
    }
    const row = await loadUserBooking(
      res.locals.clerkUserId as string,
      params.data.bookingId,
    );
    if (!row) {
      res.status(404).json({ error: "Booking was not found." });
      return;
    }
    res.json(GetBookingResponse.parse(asBookingResponse(row)));
  },
);

router.post(
  "/bookings/:bookingId/cancel",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const params = CancelBookingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Booking identifier is invalid." });
      return;
    }
    const row = await loadUserBooking(
      res.locals.clerkUserId as string,
      params.data.bookingId,
    );
    if (!row) {
      res.status(404).json({ error: "Booking was not found." });
      return;
    }
    const todayInIndia = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (
      row.booking.status === "CANCELLED" ||
      row.booking.status === "EXPIRED" ||
      row.booking.checkIn <= todayInIndia ||
      row.booking.paymentStatus === "PAID"
    ) {
      res.status(409).json({
        error:
          row.booking.paymentStatus === "PAID"
            ? "Contact the hotel to cancel a paid stay and arrange any eligible refund."
            : "This booking is no longer eligible for self-service cancellation.",
      });
      return;
    }
    const [updated] = await db
      .update(bookingsTable)
      .set({ status: "CANCELLED", cancelledAt: new Date() })
      .where(
        and(
          eq(bookingsTable.id, row.booking.id),
          eq(bookingsTable.clerkUserId, res.locals.clerkUserId as string),
          or(
            eq(bookingsTable.status, "CONFIRMED"),
            eq(bookingsTable.status, "PENDING_PAYMENT"),
          ),
        ),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "This booking has already changed." });
      return;
    }
    const refreshed = await loadUserBooking(
      res.locals.clerkUserId as string,
      updated.id,
    );
    if (!refreshed) {
      res.status(500).json({ error: "The cancelled booking could not be loaded." });
      return;
    }
    res.json(
      CancelBookingResponse.parse(asBookingResponse(refreshed)),
    );
  },
);

export default router;
