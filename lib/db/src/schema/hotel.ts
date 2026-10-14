import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingStatus = pgEnum("booking_status", [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
]);
export const paymentStatus = pgEnum("payment_status", [
  "NOT_STARTED",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);

export const usersTable = pgTable(
  "hotel_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("hotel_users_clerk_id_idx").on(table.clerkUserId)],
);

export const hotelsTable = pgTable("hotels", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  location: text("location").notNull(),
  description: text("description").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  amenities: text("amenities")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  serviceFeeMinor: integer("service_fee_minor").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const roomTypesTable = pgTable(
  "room_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: uuid("hotel_id")
      .notNull()
      .references(() => hotelsTable.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url").notNull(),
    gallery: text("gallery")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    maxGuests: integer("max_guests").notNull(),
    bed: text("bed_configuration").notNull(),
    sizeSqm: integer("size_sqm").notNull(),
    amenities: text("amenities")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    basePriceMinor: integer("base_price_minor").notNull(),
    inventory: integer("inventory").notNull(),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("room_types_hotel_published_idx").on(table.hotelId, table.published),
    index("room_types_category_idx").on(table.category),
  ],
);

export const roomInventoryTable = pgTable(
  "room_inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypesTable.id, { onDelete: "cascade" }),
    inventoryDate: date("inventory_date", { mode: "string" }).notNull(),
    totalUnits: integer("total_units").notNull(),
    blockedUnits: integer("blocked_units").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("room_inventory_room_date_idx").on(
      table.roomTypeId,
      table.inventoryDate,
    ),
  ],
);

export const seasonalRatesTable = pgTable(
  "seasonal_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    pricePerNightMinor: integer("price_per_night_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("seasonal_rates_room_dates_idx").on(
      table.roomTypeId,
      table.startDate,
      table.endDate,
    ),
  ],
);

export const bookingsTable = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    clerkUserId: text("clerk_user_id").notNull(),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypesTable.id),
    checkIn: date("check_in", { mode: "string" }).notNull(),
    checkOut: date("check_out", { mode: "string" }).notNull(),
    rooms: integer("rooms").notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    status: bookingStatus("status").notNull().default("PENDING_PAYMENT"),
    paymentStatus: paymentStatus("payment_status")
      .notNull()
      .default("NOT_STARTED"),
    currency: text("currency").notNull().default("INR"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    taxMinor: integer("tax_minor").notNull(),
    serviceFeeMinor: integer("service_fee_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("bookings_user_idempotency_idx").on(
      table.clerkUserId,
      table.idempotencyKey,
    ),
    index("bookings_room_dates_idx").on(
      table.roomTypeId,
      table.checkIn,
      table.checkOut,
      table.status,
    ),
    index("bookings_user_created_idx").on(table.clerkUserId, table.createdAt),
  ],
);

export const bookingGuestsTable = pgTable("booking_guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  specialRequests: text("special_requests").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatus("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    webhookEventId: text("webhook_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("payments_booking_idx").on(table.bookingId),
    uniqueIndex("payments_webhook_event_idx").on(table.webhookEventId),
  ],
);

export const refundsTable = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => paymentsTable.id),
  amountMinor: integer("amount_minor").notNull(),
  status: text("status").notNull().default("PENDING"),
  providerRefundId: text("provider_refund_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const amenitiesTable = pgTable("amenities", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
});

export const roomTypeAmenitiesTable = pgTable(
  "room_type_amenities",
  {
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypesTable.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenitiesTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roomTypeId, table.amenityId] }),
  ],
);

export const couponsTable = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  discountBps: integer("discount_bps").notNull().default(0),
  discountMinor: integer("discount_minor").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  maxRedemptions: integer("max_redemptions"),
  redemptionCount: integer("redemption_count").notNull().default(0),
  active: boolean("active").notNull().default(false),
});

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contactMessagesTable = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const newsletterSubscribersTable = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export const insertHotelSchema = createInsertSchema(hotelsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRoomTypeSchema = createInsertSchema(roomTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const hotelSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  location: z.string(),
  description: z.string(),
  phone: z.string(),
  email: z.string(),
});

export type Hotel = typeof hotelsTable.$inferSelect;
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type RoomType = typeof roomTypesTable.$inferSelect;
export type InsertRoomType = z.infer<typeof insertRoomTypeSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
