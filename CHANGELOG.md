# Changelog

## 2026-11-16 — Platform foundation update
- Preserved the existing Exovia Events React/Vite website, design and public assets.
- Added initial centralized Supabase schema/migration for events, dates, packages, stall inventory, vendors, leads, bookings, payment records/documents, referrals, employees, event operations, banners, announcements, tasks, activity and WhatsApp logs.
- Enabled RLS and added initial role-aware policies and public read policies for published events/available inventory.
- Added a private payment evidence storage bucket and a non-public transactional stall reservation primitive.
- Fixed TypeScript `requestIdleCallback` fallback narrowing issue.
- Updated build to run TypeScript checks before Vite.
- Corrected `.env.example` and documented public vs server-only configuration.

## Known incomplete work
The React application still uses its legacy localStorage CRM and client-side PIN gate. The migration is a database foundation, not a completed integration. Server APIs, Supabase Auth UI, public booking API, payment upload/verification, referral UI, operational modules, WhatsApp delivery and automated tests remain to be implemented and verified.
