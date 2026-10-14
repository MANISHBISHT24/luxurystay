import { Router, type IRouter } from "express";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  lt,
  or,
} from "drizzle-orm";
import {
  GetHotelResponse,
  GetRoomTypeParams,
  GetRoomTypeResponse,
  GetRoomTypesQueryParams,
  GetRoomTypesResponseItem,
  GetRoomTypesResponse,
} from "@workspace/api-zod";
import {
  bookingsTable,
  db,
  hotelsTable,
  roomInventoryTable,
  roomTypesTable,
  seasonalRatesTable,
} from "@workspace/db";

const router: IRouter = Router();
const dayMilliseconds = 24 * 60 * 60 * 1000;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
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

async function availableRooms(
  roomTypeId: string,
  inventory: number,
  checkIn?: string,
  checkOut?: string,
): Promise<number> {
  if (!checkIn || !checkOut) return inventory;
  const now = new Date();
  const [reservations, overrides] = await Promise.all([
    db
      .select({
        checkIn: bookingsTable.checkIn,
        checkOut: bookingsTable.checkOut,
        rooms: bookingsTable.rooms,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.roomTypeId, roomTypeId),
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
    db
      .select({
        inventoryDate: roomInventoryTable.inventoryDate,
        totalUnits: roomInventoryTable.totalUnits,
        blockedUnits: roomInventoryTable.blockedUnits,
      })
      .from(roomInventoryTable)
      .where(
        and(
          eq(roomInventoryTable.roomTypeId, roomTypeId),
          gte(roomInventoryTable.inventoryDate, checkIn),
          lt(roomInventoryTable.inventoryDate, checkOut),
        ),
      ),
  ]);

  const inventoryByDate = new Map(
    overrides.map((item) => [
      item.inventoryDate,
      Math.max(0, item.totalUnits - item.blockedUnits),
    ]),
  );
  const nights = listNights(checkIn, checkOut);
  if (!nights.length) return 0;

  return Math.max(
    0,
    Math.min(
      ...nights.map((night) => {
        const nightInventory = inventoryByDate.get(night) ?? inventory;
        const reserved = reservations
          .filter(
            (reservation) =>
              reservation.checkIn <= night && reservation.checkOut > night,
          )
          .reduce((sum, reservation) => sum + reservation.rooms, 0);
        return nightInventory - reserved;
      }),
    ),
  );
}

async function priceForRange(
  roomTypeId: string,
  basePrice: number,
  checkIn?: string,
  checkOut?: string,
): Promise<number> {
  if (!checkIn || !checkOut) return basePrice;
  const [rates, nights] = await Promise.all([
    db
      .select({
        startDate: seasonalRatesTable.startDate,
        endDate: seasonalRatesTable.endDate,
        price: seasonalRatesTable.pricePerNightMinor,
      })
      .from(seasonalRatesTable)
      .where(
        and(
          eq(seasonalRatesTable.roomTypeId, roomTypeId),
          lt(seasonalRatesTable.startDate, checkOut),
          gt(seasonalRatesTable.endDate, checkIn),
        ),
      )
      .orderBy(desc(seasonalRatesTable.startDate)),
    Promise.resolve(listNights(checkIn, checkOut)),
  ]);
  if (!nights.length) return basePrice;

  const nightlyTotal = nights.reduce((sum, night) => {
    const rate = rates.find(
      (candidate) =>
        candidate.startDate <= night && candidate.endDate > night,
    );
    return sum + (rate?.price ?? basePrice);
  }, 0);
  return Math.round(nightlyTotal / nights.length);
}

function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

router.get("/hotel", async (_req, res): Promise<void> => {
  const [hotel] = await db.select().from(hotelsTable).limit(1);
  if (!hotel) {
    res.status(503).json({ error: "Hotel details are not configured yet." });
    return;
  }
  res.json(
    GetHotelResponse.parse({
      name: hotel.name,
      tagline: hotel.tagline,
      location: hotel.location,
      description: hotel.description,
      phone: hotel.phone,
      email: hotel.email,
      amenities: hotel.amenities,
    }),
  );
});

router.get("/room-types", async (req, res): Promise<void> => {
  const raw = req.query;
  const checkInDate = parseDateParam(raw.checkIn);
  const checkOutDate = parseDateParam(raw.checkOut);
  if (
    (raw.checkIn !== undefined && !checkInDate) ||
    (raw.checkOut !== undefined && !checkOutDate)
  ) {
    res.status(400).json({ error: "Use valid YYYY-MM-DD stay dates." });
    return;
  }

  const parsed = GetRoomTypesQueryParams.safeParse({
    ...raw,
    checkIn: checkInDate,
    checkOut: checkOutDate,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Room search filters are invalid." });
    return;
  }
  const params = parsed.data;
  if (
    (params.checkIn && !params.checkOut) ||
    (!params.checkIn && params.checkOut) ||
    (params.checkIn &&
      params.checkOut &&
      params.checkOut.getTime() <= params.checkIn.getTime())
  ) {
    res.status(400).json({ error: "Check-out must be after check-in." });
    return;
  }

  const checkIn = params.checkIn ? toDateString(params.checkIn) : undefined;
  const checkOut = params.checkOut ? toDateString(params.checkOut) : undefined;
  const [rooms, hotel] = await Promise.all([
    db
      .select()
      .from(roomTypesTable)
      .where(eq(roomTypesTable.published, true))
      .orderBy(roomTypesTable.basePriceMinor),
    db.select().from(hotelsTable).limit(1),
  ]);
  const hotelCurrency = hotel[0]?.currency ?? "INR";
  const totalGuests = (params.adults ?? 1) + (params.children ?? 0);
  const requestedRooms = params.rooms ?? 1;

  const items = await Promise.all(
    rooms.map(async (room) => {
      if (totalGuests > room.maxGuests * requestedRooms) return null;
      if (params.category && params.category !== room.category) return null;
      if (
        params.amenities?.length &&
        !params.amenities.every((amenity) => room.amenities.includes(amenity))
      ) {
        return null;
      }

      const [available, nightlyPrice] = await Promise.all([
        availableRooms(room.id, room.inventory, checkIn, checkOut),
        priceForRange(room.id, room.basePriceMinor, checkIn, checkOut),
      ]);
      if (available < requestedRooms) return null;
      if (params.minPrice !== undefined && nightlyPrice < params.minPrice * 100) {
        return null;
      }
      if (params.maxPrice !== undefined && nightlyPrice > params.maxPrice * 100) {
        return null;
      }

      return GetRoomTypesResponseItem.parse({
        id: room.id,
        name: room.name,
        category: room.category,
        description: room.description,
        imageUrl: room.imageUrl,
        gallery: room.gallery,
        maxGuests: room.maxGuests,
        bed: room.bed,
        sizeSqm: room.sizeSqm,
        amenities: room.amenities,
        pricePerNight: nightlyPrice,
        currency: hotelCurrency,
        inventory: room.inventory,
        availableRooms: available,
        published: room.published,
      });
    }),
  );
  res.json(GetRoomTypesResponse.parse(items.filter((item) => item !== null)));
});

router.get("/room-types/:roomTypeId", async (req, res): Promise<void> => {
  const params = GetRoomTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Room type identifier is invalid." });
    return;
  }
  const [room] = await db
    .select()
    .from(roomTypesTable)
    .where(
      and(
        eq(roomTypesTable.id, params.data.roomTypeId),
        eq(roomTypesTable.published, true),
      ),
    )
    .limit(1);
  if (!room) {
    res.status(404).json({ error: "Room type was not found." });
    return;
  }
  const [hotel] = await db.select().from(hotelsTable).limit(1);
  const [available, price] = await Promise.all([
    availableRooms(room.id, room.inventory),
    priceForRange(room.id, room.basePriceMinor),
  ]);
  res.json(
    GetRoomTypeResponse.parse({
      id: room.id,
      name: room.name,
      category: room.category,
      description: room.description,
      imageUrl: room.imageUrl,
      gallery: room.gallery,
      maxGuests: room.maxGuests,
      bed: room.bed,
      sizeSqm: room.sizeSqm,
      amenities: room.amenities,
      pricePerNight: price,
      currency: hotel?.currency ?? "INR",
      inventory: room.inventory,
      availableRooms: available,
      published: room.published,
    }),
  );
});

export default router;
