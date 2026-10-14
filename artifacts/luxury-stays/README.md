# The Serein

A hotel booking website for The Serein, a sample Kerala coast resort. The guest experience and API are backed by the project's PostgreSQL database. The application currently creates safe, expiring booking holds; it does not claim that a booking is paid or confirmed.

## Development

From the workspace root:

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/luxury-stays run dev
```

The managed API and web workflows are configured in the project. The development database is already provisioned and contains one hotel and three sample room types. To update the schema after editing `lib/db/src/schema/`, run the Drizzle push command above.

## Authentication and administrator access

The site uses Replit-managed Clerk. Its keys are provisioned in the Replit environment and are not stored in source control. Public routes stay available to signed-out guests; booking, stay history, and the admin interface require sign-in.

To grant administrator access, add the administrator's Clerk user ID to the server-only `ADMIN_CLERK_USER_IDS` environment variable. For multiple administrators, use a comma-separated list. Never accept an administrator role from browser input.

The current staff interface is limited to an operations summary and a filterable booking list. Room/catalog editing, inventory management, coupons, reviews, content editing, and payment/refund administration are not implemented yet.

## Payments and email

No payment gateway is connected yet. New bookings are marked `PENDING_PAYMENT`, inventory is held for 15 minutes, and the booking cannot become `CONFIRMED` from a browser action. The brief requested Razorpay; that provider is not available in the supported billing connection flow for this app. Connect an available payment provider before enabling customer checkout or production bookings.

Transactional email is also not configured. Booking and contact data are persisted, but confirmation, reset, and reminder emails are not sent. Configure an approved mail provider and sender before using this for guests.

## Configuration

See `.env.example` for variable names and placeholders. Replit supplies `DATABASE_URL` and the Clerk keys. Do not paste live credentials into source files or commit a local `.env` file.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string supplied by the environment |
| `ADMIN_CLERK_USER_IDS` | Server-only allowlist for administrator access |
| `CORS_ORIGINS` | Optional comma-separated list for explicitly allowed external origins |
| `VITE_SITE_URL` | Optional production base URL for canonical metadata; set it to the actual published URL |
| `RESEND_API_KEY` / `EMAIL_FROM` | Reserved for a future transactional email integration |

## Data and pricing

Money is stored and transmitted as integer paise. Availability counts confirmed reservations and unexpired payment holds for every night in the requested date range; room-type inventory can be adjusted per date. Booking creation uses a database transaction and advisory locks to prevent concurrent requests from reserving the last room twice, plus a per-customer idempotency key.

The development seed sets an illustrative tax rate. Verify the actual tax treatment, cancellation/refund terms, contact details, room descriptions, and inventory with the property before accepting live reservations. Tax rules are not legal or tax advice.

Route titles and descriptions update in the browser. Configure `VITE_SITE_URL` with the real published URL before relying on canonical or social-sharing URLs; this Vite app does not server-render each route's metadata.

## Checks

```sh
pnpm run typecheck
```

The API contract lives in `lib/api-spec/openapi.yaml`. After editing it, regenerate the client and Zod validators:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Current production blockers

- Payment orders, signature verification, provider webhooks, and refunds require a connected billing provider.
- Transactional email requires a provider and verified sender.
- The remaining staff workflows listed above need their management screens and protected API operations.
- Set the administrator allowlist and confirm hotel data, tax configuration, and cancellation policy before opening the site to real guests.
