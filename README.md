# Exovia Events — existing website + centralized platform foundation

This archive preserves the existing React 19 + TypeScript + Vite website, brand assets, public content, booking popup, UPI QR and Vercel deployment configuration.

## Important implementation status

This delivery is **not yet the complete production booking platform described in the product brief**. It contains the existing website plus a comprehensive first Supabase schema/migration foundation and fixes the known TypeScript idle-callback issue. It does not claim that a cloud backend, secure admin login, vendor booking API, payment verification, WhatsApp delivery, or multi-device synchronization is live.

### Included in this update
- Preserved existing public site and visual design.
- Preserved supplied UPI QR and UPI display configuration.
- Added `supabase/migrations/20261116000100_exovia_core.sql`.
- Replaced `supabase-schema.sql` with the centralized schema foundation.
- Added core event dates, packages, stall inventory, vendors, leads, bookings, booking slots, payments, private payment-document metadata, referrals, employees, facilities, checklists, banners, announcements, tasks, activity logs and WhatsApp message log tables.
- Added role enum, RLS enablement/policies, indexes, private payment-document bucket and a locked-down transactional stall reservation primitive.
- Corrected the malformed LinkedIn/admin-PIN environment example.
- Fixed the `requestIdleCallback` TypeScript narrowing issue.
- Made production build run TypeScript checking before Vite.

## Stack and configuration

- Frontend: React + TypeScript + Vite.
- Hosting: Vercel.
- Database/auth/storage target: Supabase.
- Existing source uses browser localStorage for CRM records. This is still the current app behavior until the application data layer and server endpoints are migrated. Do not use it as the authoritative production store.

## Local setup (Windows CMD)

```cmd
npm install
copy .env.example .env
npm run typecheck
npm run build
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and apply `supabase/migrations/20261116000100_exovia_core.sql` to a fresh project.
3. Create the first trusted administrator using a controlled server-side provisioning process. Do not allow public self-assignment of privileged roles.
4. Configure Supabase Auth redirect URLs for the local site and production domain.
5. Configure environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable/anon key only)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to Vite/browser)
6. Review and test every RLS policy before entering real customer or financial data.

The migration intentionally does not grant anonymous users direct write access to vendors, bookings, payments, inventory, or referral records. A trusted server-side API must validate the request, calculate prices from database records, resolve referral attribution, create booking/payment records, and call an atomic inventory allocation operation. The reservation primitive is not exposed to browser roles.

## Payment evidence and verification

The storage bucket `exovia-payment-documents` is private. A secure server route must authenticate/authorize the uploader, validate MIME type and size, store the file, and issue short-lived signed URLs to authorized finance/admin users. A screenshot is not proof of bank settlement. Payment verification must remain a separate finance action and must be audited.

## Security warning about the current admin UI

The existing `src/Admin.tsx` still contains the legacy client-side PIN gate. A `VITE_` value is public in the frontend bundle, and sessionStorage is not authentication. Do not expose `/admin` as a secure production operations console or store real customer/payment information until Supabase Auth, server-side authorization and RLS are integrated into the UI and APIs. Remove the legacy PIN gate as part of that integration; do not treat changing the PIN as a security fix.

## Still required to meet the full product brief

- Supabase client/data repository integration and migration of legacy CRM records.
- Secure admin login, user provisioning and complete role-specific authorization.
- Server-side CRUD APIs for events, dates, packages, inventory, leads, vendors, bookings, tasks and reports.
- Complete multi-step public vendor booking journey.
- Server-validated pricing and transactional multi-date package allocation with expiry/release of abandoned reservations.
- Payment document upload route, private signed access, verification history and idempotent payment updates.
- Employee referral links, attribution and performance reports.
- Event facilities, setup checklists, banners and announcements UI.
- Public Live Events backed by database records and realtime/cache refresh.
- WhatsApp Cloud API and email delivery with opt-in and approved templates.
- Automated unit, API, RLS, concurrency, mobile and end-to-end tests.

## Vercel deployment

Keep the existing Vercel project and root directory. Set the Vite public variables in Vercel for the public website. Configure server-only secrets only in server-side function environment settings. Never put a Supabase service-role key or WhatsApp token in a `VITE_` variable.

## Release rule

Do not describe the system as fully implemented or accept real bookings/payments until the missing server/API/UI integrations and the test journey in the product brief have been completed successfully.
