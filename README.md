# LuxuryStay

LuxuryStay is a responsive hotel and resort website with a database-backed room catalogue, availability search, server-priced reservations, customer accounts, and a protected operations area.

## Requirements

- Node.js 24.11 or newer
- PostgreSQL 14 or newer
- npm

## Local setup

1. Create a PostgreSQL database named luxurystay.
2. Copy .env.example to .env and set DATABASE_URL, AUTH_SECRET, and AUTH_URL.
3. Generate an Auth.js secret with:

       node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"

   Put the result in AUTH_SECRET.
4. Install dependencies and generate the database client:

       npm install
       npx prisma generate

   If npm asks whether to run dependency setup scripts, allow the scripts for prisma, @prisma/engines, esbuild, and unrs-resolver. Prisma uses its engine during generation and migrations.
5. Apply the checked-in migration and insert starter room inventory:

       npm run db:deploy
       npm run db:seed

6. Start the site:

       npm run dev

   Open http://localhost:3000.

To change the schema during development, use npm run db:migrate -- --name describe_change, then commit the generated migration.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| DATABASE_URL | Yes | PostgreSQL connection string |
| AUTH_SECRET | Yes | Auth.js session encryption |
| AUTH_URL | Yes | Canonical site URL, including scheme |
| HOTEL_TIMEZONE | No | IANA time zone used for arrival dates; defaults to Asia/Kolkata |
| HOTEL_TAX_PERCENT | No | Fallback tax percent when no hotel settings row exists; defaults to 12 |
| ADMIN_EMAIL | No | Email for the first seeded administrator |
| ADMIN_PASSWORD | No | Password for the first seeded administrator; set only for the initial seed |
| RAZORPAY_KEY_ID | No | Razorpay test mode key; must start with rzp_test_ |
| RAZORPAY_KEY_SECRET | No | Server-only Razorpay test secret |
| RAZORPAY_WEBHOOK_SECRET | No | Secret configured for the test-mode webhook endpoint |
| RESEND_API_KEY | No | Enables email verification, password reset and booking email |
| RESEND_FROM | No | Verified sender, such as LuxuryStay <bookings@your-domain.example> |
| CRON_SECRET | No | Reserved for an external expiry job; expired holds are already ignored by availability checks |

Public registration always assigns the CUSTOMER role. Seed an administrator by setting ADMIN_EMAIL and ADMIN_PASSWORD before running the seed command. The seed command can set that account's role to ADMIN; there is no public admin-registration route.

## Payments and email

Without Razorpay test credentials, reservation requests can create a 15-minute pending hold but cannot confirm a stay. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to test-mode values to enable checkout. Enable automatic payment capture in the Razorpay test dashboard and configure a webhook URL of https://your-host/api/payments/webhook for payment.captured, payment.failed, and refund.processed.

Payment status is checked on the server against the stored order and Razorpay's payment record. A booking becomes confirmed only after a captured payment matches the stored amount and its reserved room is still available. Late, duplicate or mismatched captures create a tracked refund; a provider error marks the refund NEEDS_REVIEW for administrator follow-up.

Set both RESEND_API_KEY and RESEND_FROM to enable email verification at registration, password reset links and reservation confirmation emails. Contact enquiries are saved to PostgreSQL; when the hotel contact email and Resend are configured, a best-effort notification is also sent.

## Admin area

Sign in with the seeded administrator credentials, then open /admin. The dashboard reads live booking, occupancy and payment data. Admin pages manage rooms, seasonal rates, offers, guest enquiries, property settings, customer summaries, CSV reports and audit entries. Each admin API checks the administrator role on the server.

## Checks

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npx playwright install chromium
    npm run test:e2e

The pricing tests run without a database. Search, account, admin and payment flows require PostgreSQL; checkout and email delivery also require their respective test credentials.

## Deployment and operations

- Set production secrets in the hosting provider's secret manager. Do not commit .env.
- Use PostgreSQL with backups and point-in-time recovery appropriate to the booking volume. For a manual backup, use pg_dump with format custom and the configured DATABASE_URL; restore with pg_restore into a separate database and verify it before replacing production data.
- Run npm run db:deploy as a release step, then npm run build and npm start.
- Terminate HTTPS at a trusted reverse proxy. Configure it to overwrite x-real-ip or x-forwarded-for; the database-backed request limiter hashes those headers to identify clients.
- The privacy notice and booking terms are starter copy. Replace them with the operating property's actual legal entity, jurisdiction, retention period, cancellation policy and local requirements before launch.
- Seeded hotel photography uses remote Unsplash image URLs. Replace these with property-owned or properly licensed images before launch.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM, Zod, Auth.js, Razorpay, Resend-compatible email delivery, ESLint, and Vitest.
