# Strelnica — Recommendations (v2)

Single-source recommendation doc, rewritten to reflect all clarifications. The detailed implementation plan comes next.

---

## 0. Scope Snapshot

**In scope**
- Members-only reservation system for two shooting ranges (50m rifle and brokový/shotgun).
- Admin-managed users (invitation + verification flow).
- Booking request → admin approval → user notification.
- Annual (calendar-year) membership tracking, paid/unpaid flag only (no payment processing).
- Check-in (5 min before start), statistics, PDF exports.
- Slovak + Hungarian full localization, including legal pages.
- Responsive UI optimized for mobile, tablet, desktop.
- Contact form.
- GDPR + range-rules consent, versioned.

**Out of scope (explicitly)**
- Non-member / guest bookings (only members book).
- On-site payment processing or collection.
- Physical access control (keys, door PINs, smart locks).
- Instructor scheduling (shooters operate independently; accompanying non-license holders are the shooter's responsibility and are not tracked).
- Public pricing (hidden for now).
- Offline tablet operation (tablet is a web helper — online only).

---

## 1. Tech Stack

### Core
- **Next.js latest stable (App Router, RSC, Server Actions)** — at the time of writing, **16.2.3** (verified on npm). Use `create-next-app@latest` at project start; do not pin to a specific major in this doc. Single deployable on Coolify, `output: "standalone"` as a long-running Node server.
- **PostgreSQL 16** — the only data store.
- **Drizzle ORM** — type-safe, reviewable SQL migrations.
- **Tailwind CSS + shadcn/ui** — mobile-first, tablet-friendly, accessible.
- **react-hook-form + zod** — validation shared client/server.
- **next-intl** — `/sk` and `/hu` routing, locale-aware dates via `date-fns` locales.
- **FullCalendar** (or custom shadcn grid) — weekly/daily view, per-range columns.

### Auth
- **Auth.js v5 (NextAuth)** — email + phone credentials, magic-link invitation acceptance, TOTP mandatory for admins and recommended for members.
- Separate admin secret per admin for out-of-band approval (stored hashed).

### Async / scheduled work
- **pg-boss** inside Postgres — delayed jobs (5-min reminders, no-show sweep, stale-request auto-decline), recurring crons (license expiry warnings, nightly cleanup, membership rollover).
- No Redis, no external queue.

### Notifications — reuse existing `hono_bun` service
- **Location**: `/Users/pictus/PW-Local-Projects/hono_bun` — already running, hosts Titan SMTP (nodemailer), smstools.sk, React-Email templates, error handler, CORS, Croner.
- **Integration model**: we add a new "origin" named `strelnica` following the existing per-origin convention (like `barubo`, `pictusweb`, `proud2next`, etc.).
- **Do not** mutate existing origins' code or shared files beyond registering new routes; add siblings only. Full contract in §11.
- Reason to keep it split: Next.js has historically had friction with SMTP boundaries; your Hono service already works in production. Also isolates the failure domain and keeps one SMTP/SMS integration surface for all your projects.

### Supporting
- **@react-pdf/renderer** — server-side PDF exports.
- **Glitchtip** (self-hosted, Sentry-compatible) — error monitoring, same Coolify host.
- **Uptime Kuma** — uptime probes.
- **Postgres backups** — `pg_dump` nightly to offsite S3-compatible (Backblaze B2 or Hetzner Storage Box). Weekly restore test.

### Hosting
- **Coolify on a VPS in the Czech Republic** — same EU jurisdiction as SK users, no cross-border transfer concerns.

### Where n8n fits
- Only for peripheral/ad-hoc automations (CRM sync, scheduled stakeholder reports, Telegram notifications to you). **Not in the core booking path.**

---

## 2. Architecture Overview

```
          ┌──────────────────────────────────────────┐
          │  Browser / Tablet (SK or HU UI)          │
          └──────────────────┬───────────────────────┘
                             │  HTTPS
          ┌──────────────────▼───────────────────────┐
          │  Next.js app (Coolify container)         │
          │  - RSC pages, Server Actions             │
          │  - Middleware: i18n, auth, rate-limit    │
          │  - pg-boss worker (same process or sidecar)│
          └───────┬────────────────────────┬─────────┘
                  │ SQL                    │ HTTPS (internal, bearer-token)
          ┌───────▼──────────┐     ┌───────▼────────────────────────┐
          │  PostgreSQL 16   │     │  hono_bun (existing service)   │
          │  - domain tables │     │  - /api/strelnica/* endpoints  │
          │  - pg-boss tables│     │  - Titan SMTP (nodemailer)     │
          │  - audit log     │     │  - smstools.sk                 │
          └──────────────────┘     │  - React-Email TSX templates   │
                                   │  - MongoDB (its own, unrelated)│
                                   └────────────────────────────────┘
```

- **pg-boss runs in the Next.js Node process** (simplest) or in a tiny sidecar container sharing the same DB. Both valid — sidecar gives cleaner restarts, embedded is simpler to operate.
- **Every outbound email/SMS goes through pg-boss → hono_bun → SMTP/SMS**, so retries and the audit log are uniform.
- Next.js owns the **domain DB (Postgres)**; hono_bun's MongoDB is irrelevant to Strelnica — we do not share state with other hono_bun origins.
- Internal traffic authenticated with a per-project bearer token (`STRELNICA_API_TOKEN`), validated inside the hono_bun strelnica routes.

---

## 3. Confirmed Domain Rules

| Rule | Value |
|---|---|
| Ranges | **Two**: `R50` (50m rifle), `RBR` (brokový/shotgun). One shooter per range at a time. |
| Slot length | **60 minutes**. Members may book multiple contiguous hours in one booking. |
| Membership | **Annual, calendar year (Jan 1 – Dec 31)**. Full fee regardless of join month. |
| Cancellation of membership | Any time. **No refund.** |
| Admins | **Two**, each with their own account, TOTP, and approval code. |
| Eligibility to shoot | Member with active paid membership + valid (non-expired) zbrojný preukaz. |
| Guests (non-license holders) | Member may bring guests; shooter is fully responsible. Guest identities **not stored** — booking form captures only a count. |
| Non-members | **Cannot book.** Out of system scope entirely. |
| On-site presence | Hybrid (members self-serve when no admin; admin sometimes on site). App does not care about physical access. |
| Pricing | Hidden on public site for now. |
| Languages | **Slovak + Hungarian**, UI and legal pages, fully versioned. |
| Hosting | VPS in Czech Republic, Coolify. |

---

## 4. Key Design Decisions

### 4.1 Conflict-free bookings — yes, enforced at three layers

**Your expectation is correct**: the system never lets a user request a booking for a slot that is already taken. Defense in depth:

1. **Client UI** shows only free hours. Busy hours (status `requested`, `approved`, or `checked_in`) are greyed out and un-clickable. The calendar reads a server-rendered availability map.
2. **Server Action** re-checks availability inside a transaction before inserting the booking — never trusts client state.
3. **Database** enforces a partial unique constraint:
   ```
   UNIQUE (range_id, hour_bucket) WHERE status IN ('requested','approved','checked_in')
   ```
   or equivalently an exclusion constraint on `tstzrange(starts_at, ends_at)` with `&&` operator per range. This makes it physically impossible for two "live" bookings to overlap on the same range, even under a race condition.

A `requested` booking holds the slot. If admin declines or it auto-expires, the slot frees up.

### 4.2 Stale requests auto-expire

pg-boss job scheduled per booking: if still `requested` after **24 hours**, auto-decline with reason `timeout`, free the slot, notify the user. Prevents popular hours from being frozen by an unanswered request.

### 4.3 Approval flow

1. Member submits request → validate eligibility (active membership, non-expired license, no overlap, within opening hours, outside closures) → insert as `requested`.
2. Notification job fires → email + SMS to both admins with two single-use signed links:
   `/admin/decide/<token>?action=approve` and `...?action=decline`.
3. Link opens a minimal page asking for that admin's TOTP code (preferred) or static secret code. Rate-limited, logged.
4. First admin to decide wins; token is burned; the other admin's link is invalidated.
5. On approve → confirmation email + SMS to user; reminder job scheduled for `starts_at − 5 min`; no-show job scheduled for `starts_at + 15 min`.
6. On decline → rejection email to user with admin's optional reason.

### 4.4 Two-range calendar UX

- Mobile: tabs at top ("50m" / "Broková"), one range visible at a time.
- Tablet/desktop: two columns side-by-side, same time axis.
- Range is selected before picking time. A multi-hour booking is one contiguous block within one range.

### 4.5 Multi-hour booking

- UI: user picks a start hour, then "duration" (1…N). N capped by remaining contiguous free hours on that range that day.
- Server: re-validates contiguity; inserts one `bookings` row spanning the range (`starts_at`, `ends_at`).
- Conflict check: uses `tstzrange` exclusion so any partial overlap fails.

### 4.6 Localization

- `next-intl` for UI strings, `/sk/*` and `/hu/*` routes, user's preferred locale stored on `users.locale`, falls back to browser `Accept-Language`.
- **Legal pages are full translations, not machine-translated.** `consent_documents` table keys by `(kind, version, locale)`; a user's consent records which `version` they accepted. When the SK version changes, a new HU translation must be published before going live.
- Dates, times, numbers via `date-fns` locales.

### 4.7 Tablet as helper, not kiosk

- Same responsive web app on an iPad in the lobby.
- Primary use: daily schedule view + check-in tap.
- Since check-in can equally be done online from the member's phone, **no offline service worker** needed. If the tablet's WiFi is down, use your phone.

### 4.8 Check-in

- At `starts_at − 5 min`: reminder SMS/email to the member with a one-tap "I'm here" link (opens a short-lived page requiring login).
- Admin can also mark members checked-in from the tablet UI.
- At `starts_at + 15 min`: if still not checked in → `no_show`.
- At `ends_at`: booking auto-completes; `effective_minutes` counted into the member's lifetime hours.

---

## 5. Data Model (revised)

### `ranges`
- `id` (text PK, e.g., `R50`, `RBR`)
- `name_sk`, `name_hu`
- `active` (bool)
- `sort_order`

### `users`
- `id` (uuid PK), `email` (unique), `phone_e164` (unique)
- `first_name`, `last_name`
- `birth_date`, `birth_place`
- `address_street`, `address_city`, `address_zip`, `address_country`
- `zbrojny_preukaz_number` (**encrypted at app layer**, AES-GCM)
- `zbrojny_preukaz_category`
- `zbrojny_preukaz_issued_at`, `zbrojny_preukaz_expires_at`, `zbrojny_preukaz_issuing_authority`
- `role` (`admin` | `member`)
- `status` (`invited` | `pending_verification` | `active` | `suspended` | `anonymized`)
- `locale` (`sk` | `hu`)
- `email_verified_at`, `phone_verified_at`
- `invited_by`, `invitation_token_hash`, `invitation_expires_at`
- `totp_secret_encrypted`, `totp_enabled_at`
- `admin_approval_code_hash` (Argon2, admins only; rotatable)
- `created_at`, `updated_at`, `last_login_at`, `last_login_ip`
- `gdpr_consent_version`, `gdpr_consent_at`
- `range_rules_consent_version`, `range_rules_consent_at`
- `notes_admin`

### `memberships`
- PK `(user_id, year)`
- `fee_amount`, `currency` (default `EUR`)
- `paid_at`, `payment_method` (`cash` | `transfer` | `other`), `recorded_by`, `note`
- `cancelled_at`, `cancelled_reason`

### `opening_hours_templates` (weekly recurring, editable)
- `id`, `range_id` (FK), `weekday` (0–6), `start_time`, `end_time`
- `valid_from`, `valid_to` (null = current)
- `created_by`, `created_at`

### `closures` (ad-hoc blackouts)
- `id`, `range_id` (FK; nullable = both ranges), `starts_at`, `ends_at`, `reason_sk`, `reason_hu`, `created_by`, `created_at`

### `bookings`
- `id` (uuid), `user_id` (FK, **not null**), `range_id` (FK)
- `starts_at`, `ends_at` (timestamptz); `time_range` generated `tstzrange` column for exclusion constraint
- `status` (`requested` | `approved` | `declined` | `cancelled` | `checked_in` | `completed` | `no_show`)
- `requested_at`, `decided_by`, `decided_at`, `decision_reason`
- `check_in_at`, `auto_completed_at`, `effective_minutes`
- `guest_count` (int, default 0 — non-license accompanying persons)
- `user_note`, `admin_note`
- `reminder_job_id`, `noshow_job_id`, `expiry_job_id` (pg-boss job IDs, for cancellation)
- `rules_consent_version_at_booking`
- **Exclusion constraint**: no overlapping `(range_id, time_range)` where status is live.

### `admin_approval_tokens`
- `id`, `booking_id`, `admin_user_id`, `action` (`approve` | `decline`)
- `token_hash`, `expires_at`, `used_at`, `used_ip`

### `contact_messages`
- `id`, `name`, `email`, `phone`, `message`, `locale`, `ip`, `user_agent`, `created_at`, `handled_at`, `handled_by`

### `notifications_log`
- `id`, `channel` (`email` | `sms`), `to`, `template`, `locale`, `subject`, `body_hash`
- `booking_id` (nullable), `user_id` (nullable)
- `sent_at`, `provider_response`, `status` (`sent` | `failed` | `retrying`)

### `audit_log` (append-only)
- `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`
- `before_jsonb`, `after_jsonb`
- `ip`, `user_agent`, `created_at`

### `consent_documents`
- PK `(kind, version, locale)` — `kind` in (`gdpr`, `range_rules`, `terms`)
- `content_md`, `published_at`, `published_by`

### Auth library tables
- `sessions`, `verification_tokens`, `accounts` — whatever Auth.js needs.

---

## 6. Pages & Flows

### Public
- `/` — landing, calendar preview (view-only without login), language switcher.
- `/kontakt` — contact form.
- `/gdpr` — privacy policy (SK/HU).
- `/pravidla-strelnice` — range rules + general terms (SK/HU).
- `/impressum` — operator details (IČO, DIČ, address).
- `/pozvanka/<token>` — invitation acceptance (sets password, verifies phone, accepts consents, enables TOTP).

### Member (authenticated)
- `/app` — dashboard (next booking, membership status, license expiry countdown).
- `/app/rezervacie` — make a new booking (range → date → hours → submit), see my bookings.
- `/app/profil` — view/edit my data, download my GDPR data, request anonymization.
- `/app/statistiky` — my shooting hours, visits per period.

### Admin
- `/admin` — today's schedule + pending requests.
- `/admin/pouzivatelia` — invite, edit, suspend, reset TOTP, anonymize, export CSV.
- `/admin/rezervacie` — all bookings, filter by range/user/status, manual create on behalf.
- `/admin/clenstvo` — mark payments per user per year, print payment status list.
- `/admin/otváracie-hodiny` — edit weekly template per range.
- `/admin/uzavretia` — create/manage blackouts.
- `/admin/statistiky` — all-member stats, filters, **PDF export** (active members, paying vs. not, hours per period, visits per period).
- `/admin/audit` — view audit log.
- `/admin/decide/<token>` — out-of-band approval page (TOTP/code required).

### Tablet-friendly shortcuts
- `/admin` scales cleanly; no separate "kiosk" route needed in v1.

---

## 7. Security & GDPR

### Authentication
- Argon2id password hashing.
- TOTP mandatory for admins; strongly recommended for members.
- Magic-link invitation with short-lived token (≤72h).
- Email **and** SMS verification before account activation.
- Session TTL: 7 days member, 2 hours admin (sliding).
- Re-authentication required for sensitive actions (rotate TOTP, change email/phone, export data).

### App-layer encryption
- `zbrojny_preukaz_number` and `totp_secret` encrypted AES-GCM with a key from `APP_ENCRYPTION_KEY` env var. Key rotation documented (dual-key read, single-key write).
- At-rest Postgres encryption via Coolify-managed volume or OS-level LUKS.

### Audit trail
- Every admin action (`approve`, `decline`, `create_user`, `edit_user`, `suspend`, `anonymize`, `mark_paid`, `create_closure`, `edit_hours`) writes to `audit_log` with actor, IP, user-agent, before/after JSON.
- Log is append-only (no UPDATE/DELETE grants in the DB role used by the app).

### Rate limiting
- Login, OTP verify, invitation token submit, booking request, contact form, admin decide — token bucket in Postgres (or a tiny Redis if you add one later).

### Network / HTTP hardening
- HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy via middleware.
- HTTPS only, HTTP→HTTPS redirect at the reverse proxy.
- CSRF on all state-changing endpoints (built into Server Actions).

### GDPR operational
- Versioned consent documents; every consent record pins a version.
- Data export endpoint (`/app/profil/export`) → JSON + PDF of everything linked to the user.
- Anonymization: replace PII with null/placeholder, keep `bookings` aggregate for stats, preserve `memberships` for 10 years (accounting).
- DPA notification: if breach, documented procedure.

### Backups & DR
- Nightly `pg_dump` to offsite storage, encrypted.
- Weekly automated restore test (script).
- Retention of backups: 30 daily + 12 monthly.

---

## 8. Slovak Data Retention (baseline — verify with lawyer)

**Caveat**: not legal advice. Firearms ranges have sector-specific obligations. Before production, have a Slovak GDPR-savvy lawyer review this — and check your range's prevádzkový poriadok + conditions from the local police ("odbor dokladov a zbraní"), which usually impose a shooting-register retention period.

Governing sources:
- **Regulation (EU) 2016/679** (GDPR).
- **Zákon č. 18/2018 Z.z.** — Slovak data protection act.
- **Zákon č. 190/2003 Z.z.** — firearms and ammunition act (may impose shooting-register obligations).
- **Zákon č. 431/2002 Z.z.** — accounting act (10 years).
- **Zákon č. 222/2004 Z.z.** — VAT act (10 years, if VAT payer).

Suggested defaults:

| Data | Retention | Basis |
|---|---|---|
| Membership fee records & invoices | **10 years** | Accounting Act |
| Booking / attendance log | **3–5 years** | Operational + likely range permit clause |
| Zbrojný preukaz number + expiry (member) | **Membership duration + 3 years** | GDPR minimization |
| Name, address, birth data (member) | **Membership duration + 3 years** | GDPR minimization |
| GDPR / rules consent records | **Membership duration + 4 years** | Defense-of-claims buffer |
| Contact form messages | **1 year** | Minimization |
| Email/SMS notification logs | **12 months** | Operational |
| Audit log | **3 years** | Security, dispute evidence |
| IP / user-agent access logs | **6 months** | Minimization |
| Anonymized booking aggregates | **Indefinite** | No longer personal data |

Enforced via a **pg-boss daily sweep** that moves records past retention to anonymized form. Never hard-delete bookings linked to accounting records.

---

## 9. Remaining Small Opens

1. **No-show threshold** — do you want auto-flag-for-review after e.g. 3 no-shows in a season?
2. **Cancellation lead time** — any minimum (e.g., "cancel at least 1 hour before")? Currently assumed: cancel anytime up to `starts_at`.
3. **Admin digest** — daily morning email listing today's bookings? (Useful low-cost add.)
4. **License-expiry notification schedule** — proposed **60 / 30 / 7 days before expiry** to both user and admins; confirm.
5. **Membership rollover notification** — Dec 15 and Jan 5 reminders to members with unpaid next year? Confirm.

---

## 10. Hono Notifier Integration (hono_bun)

Existing service at `/Users/pictus/PW-Local-Projects/hono_bun`. We add a new origin `strelnica` following the established per-origin convention. **No changes to existing origins.**

### 10.1 File/folder plan

Follow the exact conventions already used by `barubo`, `pictusweb`, `proud2next`, etc.

```
hono_bun/src/
├── routes/
│   ├── strelnica/                        # NEW directory
│   │   ├── invitation.ts                 # member invitation email
│   │   ├── otp.ts                        # email + SMS OTP for verification / 2FA
│   │   ├── bookingRequestToAdmin.ts      # notify 2 admins w/ signed approve/decline links
│   │   ├── bookingApproved.ts            # confirm to member (email + SMS)
│   │   ├── bookingDeclined.ts            # reject to member (email)
│   │   ├── bookingReminder.ts            # T−5min reminder (email + SMS)
│   │   ├── bookingCancelled.ts           # member-initiated cancel notice
│   │   ├── noShowNotice.ts               # no-show notice to member
│   │   ├── licenseExpiring.ts            # zbrojný preukaz expiry warning
│   │   ├── membershipReminder.ts         # unpaid-year nag
│   │   ├── contact.ts                    # public contact form relay
│   │   └── passwordReset.ts              # member password reset
│   └── index.ts                          # EDIT: register strelnica routes (see §11.3)
│
├── services/
│   └── strelnica/                        # NEW directory
│       ├── sendInvitationEmail/invitation.ts
│       ├── sendOtpEmail/otp.ts
│       ├── sendOtpSms/sms.ts             # copy pattern from services/pictusweb/sendSmsOtp/sms.ts
│       ├── sendBookingRequestAdminEmail/adminRequest.ts
│       ├── sendBookingRequestAdminSms/adminRequest.ts
│       ├── sendBookingApprovedEmail/approved.ts
│       ├── sendBookingApprovedSms/approved.ts
│       ├── sendBookingDeclinedEmail/declined.ts
│       ├── sendBookingReminderEmail/reminder.ts
│       ├── sendBookingReminderSms/reminder.ts
│       ├── sendBookingCancelledEmail/cancelled.ts
│       ├── sendNoShowNoticeEmail/noShow.ts
│       ├── sendLicenseExpiringEmail/licenseExpiring.ts
│       ├── sendLicenseExpiringSms/licenseExpiring.ts
│       ├── sendMembershipReminderEmail/membership.ts
│       ├── sendContactEmail/contact.ts
│       └── sendPasswordResetEmail/passwordReset.ts
│
└── templates/
    └── emailTemplates/
        └── strelnica/                    # NEW directory (all React-Email TSX, SK+HU inline like barubo/BookingEmail.tsx)
            ├── InvitationEmail.tsx
            ├── VerificationOtpEmail.tsx        # email verification code
            ├── TwoFactorOtpEmail.tsx           # login 2FA code
            ├── BookingRequestAdminEmail.tsx    # with approve/decline signed links
            ├── BookingApprovedEmail.tsx
            ├── BookingDeclinedEmail.tsx
            ├── BookingReminderEmail.tsx
            ├── BookingCancelledEmail.tsx
            ├── NoShowNoticeEmail.tsx
            ├── LicenseExpiringEmail.tsx
            ├── MembershipReminderEmail.tsx
            ├── ContactFormAdminEmail.tsx
            └── PasswordResetEmail.tsx
```

Each template follows the existing pattern in `templates/emailTemplates/barubo/BookingEmail.tsx`: a React-Email component with an inline `translations` object keyed by locale (`sk`, `hu`), `render()`ed via `@react-email/render`, then sent through the transporter from `src/config/email.ts`.

### 10.2 Env vars to add in `hono_bun/.env`

Follow the existing `<ORIGIN>_MAILER_*` pattern (see `src/config/email.ts`):

```
STRELNICA_MAILER_USERNAME=...      # Titan SMTP user for the strelnica mailbox
STRELNICA_MAILER_PASSWORD=...
STRELNICA_MAILER_FROM="Strelnica <no-reply@strelnica.tld>"
STRELNICA_MAILER_BCC=archive@strelnica.tld
STRELNICA_API_TOKEN=...            # shared secret, also set on the Next.js side
STRELNICA_WEB_ORIGIN=https://strelnica.tld    # used in email links, CORS allowlist
SMSTOOLS_API_KEY=...               # already present for pictusweb; reused
```

### 10.3 Routes to register in `src/routes/index.ts`

Append a new block next to the other origins (do not touch existing blocks):

```ts
// strelnica
app.post('/api/strelnica/invitation',                sendInvitationRoute)
app.post('/api/strelnica/otp/email',                 sendOtpEmailRoute)
app.post('/api/strelnica/otp/sms',                   sendOtpSmsRoute)
app.post('/api/strelnica/booking/request-to-admin',  bookingRequestToAdminRoute)
app.post('/api/strelnica/booking/approved',          bookingApprovedRoute)
app.post('/api/strelnica/booking/declined',          bookingDeclinedRoute)
app.post('/api/strelnica/booking/reminder',          bookingReminderRoute)
app.post('/api/strelnica/booking/cancelled',         bookingCancelledRoute)
app.post('/api/strelnica/booking/no-show',           noShowNoticeRoute)
app.post('/api/strelnica/license-expiring',          licenseExpiringRoute)
app.post('/api/strelnica/membership-reminder',       membershipReminderRoute)
app.post('/api/strelnica/contact',                   contactRoute)
app.post('/api/strelnica/password-reset',            passwordResetRoute)
```

### 10.4 Route handler convention (example)

Mirrors the existing `routes/contact.ts` and `routes/pictusweb/client/sendOtpEmail.ts` style — Hono `Context` handler wrapped in `withErrorHandling`, input validated, delegates to a service:

```ts
// routes/strelnica/bookingApproved.ts
import { Context } from 'hono'
import { withErrorHandling, AppError } from '../../utils/errorHandler'
import { requireStrelnicaAuth } from '../../utils/strelnica/auth'      // NEW tiny helper
import { validateBookingApproved } from '../../utils/strelnica/validation'
import { sendBookingApprovedEmail } from '../../services/strelnica/sendBookingApprovedEmail/approved'
import { sendBookingApprovedSms } from '../../services/strelnica/sendBookingApprovedSms/approved'

export const bookingApprovedRoute = withErrorHandling(async (c: Context) => {
  requireStrelnicaAuth(c)                                                // bearer-token check

  const body = await c.req.json()
  const v = validateBookingApproved(body)
  if (!v.valid) throw new AppError(v.message ?? 'Validation failed', 400)

  await sendBookingApprovedEmail(body)
  if (body.phone) await sendBookingApprovedSms(body)

  return c.json({ success: true })
})
```

### 10.5 Canonical request payloads (from Next.js → hono_bun)

Every request: header `Authorization: Bearer ${STRELNICA_API_TOKEN}`, `Content-Type: application/json`, locale `'sk' | 'hu'` in body so the template renders in the right language.

Representative shapes (final schemas in the detailed plan):

```jsonc
// POST /api/strelnica/booking/request-to-admin
{
  "locale": "sk",
  "admins": [
    { "name": "Peter",  "email": "peter@...",  "phone": "+4219..." },
    { "name": "Jozef",  "email": "jozef@...",  "phone": "+4219..." }
  ],
  "booking": {
    "id": "uuid",
    "range": "R50",                             // or "RBR"
    "startsAt": "2026-04-20T14:00:00+02:00",
    "endsAt":   "2026-04-20T16:00:00+02:00",
    "guestCount": 0,
    "userNote": "optional"
  },
  "member": {
    "firstName": "Ján",
    "lastName":  "Novák",
    "email":     "jan@...",
    "phone":     "+4219..."
  },
  "approveLinks": [                              // one per admin, pre-signed by Next.js
    { "adminEmail": "peter@...", "approveUrl": "https://.../admin/decide/<t1>?action=approve",
      "declineUrl": "https://.../admin/decide/<t1>?action=decline" },
    { "adminEmail": "jozef@...", "approveUrl": "https://.../admin/decide/<t2>?action=approve",
      "declineUrl": "https://.../admin/decide/<t2>?action=decline" }
  ]
}
```

```jsonc
// POST /api/strelnica/booking/approved
{
  "locale": "hu",
  "to": { "email": "jan@...", "phone": "+4219...", "firstName": "Ján" },
  "booking": { "id": "uuid", "range": "R50",
               "startsAt": "2026-04-20T14:00:00+02:00",
               "endsAt":   "2026-04-20T16:00:00+02:00" }
}
```

```jsonc
// POST /api/strelnica/otp/email
{ "locale": "sk", "to": { "email": "x@...", "firstName": "Ján" },
  "code": "123456", "purpose": "email_verification" | "2fa" | "password_reset",
  "expiresInMinutes": 10 }
```

### 10.6 Security notes for the notifier endpoints

- Bearer-token check (`STRELNICA_API_TOKEN`) on every `/api/strelnica/*` route — rejected otherwise with 401.
- CORS: allow only `STRELNICA_WEB_ORIGIN` and `localhost` in dev.
- Rate limit per IP at the notifier (simple in-memory or Postgres token bucket) as a belt-and-braces measure; primary rate limiting still lives in Next.js.
- No PII in log lines beyond what the existing services already print (mask email/phone tails as `sms.ts` does).
- Templates must never embed user-supplied HTML; React-Email escapes by default — keep it that way.

### 10.7 Observed SMS/OTP pattern from `next_pw_podcast` — reuse it

I read through how the podcast app already integrates with `hono_bun` for SMS/email OTP. It's a clean pattern, battle-tested, and we should copy it verbatim for Strelnica. Key files:

- `next_pw_podcast/app/api/fleetsync/send-verification/route.ts` — initial onboarding: send email + SMS OTP in one call.
- `next_pw_podcast/app/api/user/send-phone-verification/route.ts` — authenticated flow: resend phone OTP.
- `next_pw_podcast/app/api/user/verify-contact-code/route.ts` — validate submitted OTP.
- `next_pw_podcast/lib/rateLimit.ts` — sliding-window in-memory limiter.
- `next_pw_podcast/prisma/schema.prisma` → `VerificationCode` model.

#### Flow (to reproduce in Strelnica)

```
Client → Next.js /api/.../send-*         (generate + store, POST to hono_bun)
         Next.js /api/.../verify-*       (compare hash, mark used, update user)
                   │
                   └──→ hono_bun /api/strelnica/otp/sms  (smstools.sk)
                   └──→ hono_bun /api/strelnica/otp/email (Titan SMTP)
```

#### Server-generated secrets (never client-supplied)

```ts
// generate
const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000))  // 6 digits
const token = base64url(`${identifier}:${purpose}:${expiresAt}:${hmacSig}`)              // HMAC-signed session blob

// store (never plaintext)
codeHash  = sha256(`${code}:${identifier}:${OTP_SALT}`)    // peppered hash
tokenHash = sha256(token)                                  // for lookup
```

#### `verification_codes` table (Drizzle equivalent of `VerificationCode`)

```
id          uuid pk
user_id     text               -- "identifier": member id, or email during pre-account onboarding
purpose     varchar(30)        -- e.g. 'invitation_email', 'phone_verify', '2fa', 'password_reset'
code_hash   char(64)           -- sha256 hex
token_hash  char(64) unique    -- sha256 hex, looked up on verify
expires_at  timestamptz        -- typ. +10 min
attempts    int default 0      -- incremented per wrong guess
used_at     timestamptz null
created_at  timestamptz default now()

index (user_id)
index (purpose)
```

#### Rate limits (two layers, copy exactly)

- **In-memory IP limit** (`lib/rateLimit.ts` pattern): 5–10 sends per IP per hour.
- **DB per-user/email limit**: count un-used `verification_codes` in the last 15–60 min; cap to 3–6.
- **Verify side**: global lockout 7 failed verifies per user per hour; per-code cap 5 attempts before forcing reissue.
- On resend: delete previous un-used codes for `(user_id, purpose)` so stale ones can't be reused.

#### hono_bun side (the SMS builder)

Reference: `hono_bun/src/services/pictusweb/sendSmsOtp/sms.ts`.

- Single POST to `https://api.smstools.sk/3/send_batch`.
- Body shape:
  ```json
  {
    "auth": { "apikey": "<SMSTOOLS_API_KEY>" },
    "data": {
      "message": "Váš overovací kód Strelnica: 123456. Platný 10 minút.",
      "sender": { "text": "Strelnica" },
      "recipients": [{ "phonenr": "+4219..." }]
    }
  }
  ```
- Message text built inline, branching on `purpose` (`verify` | `2fa` | `booking_reminder` | `booking_approved` | …) and `locale` (`sk` | `hu`).
- Phone numbers logged masked: `phone.slice(0, 4) + '****'`.
- Sender name `"Strelnica"` **must be pre-approved with smstools.sk** before production — alphanumeric senders are whitelisted per customer. Action item: register it with the smstools dashboard ahead of launch.
- SK/HU characters (č, š, ž, á, é, ő, ű…) force UCS-2 encoding → **max 70 chars/SMS** vs. 160 on GSM-7. Keep templates short; prefer plain codes + "Strelnica" + short instruction.

#### Env var names (follow the podcast app conventions)

```
# Next.js (strelnica web)
NEXT_PUBLIC_HONO_API_URL=https://hono.pictusweb.sk       # same var name as podcast app
STRELNICA_API_TOKEN=...                                  # NEW — bearer to hono_bun (not present in podcast yet; we add it)
OTP_SALT=...                                             # pepper for code hashes
VERIFICATION_SESSION_SECRET=...                          # HMAC key for session tokens

# hono_bun
SMSTOOLS_API_KEY=...                                     # already present
STRELNICA_API_TOKEN=...                                  # must match Next.js value
```

#### Gap in the existing podcast integration — close it for Strelnica

The podcast app currently hits hono_bun **without** authenticating the internal call — the SMS endpoint is effectively open. Since SMS costs money, for Strelnica we add a bearer-token check on every `/api/strelnica/*` route on the hono_bun side (see §10.6). The podcast app can stay as-is; we don't touch it.

#### Purposes to model in Strelnica's `verification_codes.purpose` column

```
invitation_accept        # 72h link delivered by admin
phone_verify             # during account activation
email_verify             # during account activation (usually via magic link, but also OTP fallback)
2fa                      # member/admin login
password_reset
admin_decide             # SHORT-lived (24h) token embedded in admin approval email/SMS
```

(`admin_decide` is not an OTP code but fits the same row shape: server-issued, hashed, single-use.)

---

### 10.8 What we explicitly will NOT do

- Do not add strelnica templates to `templateRegistry.ts` — that registry is for legacy generic `contact`/`booking`/`adminOrder*` types. Strelnica gets its own dedicated services/templates, so keep it out of the registry to avoid coupling.
- Do not share the hono_bun MongoDB. Strelnica data lives in Postgres owned by Next.js.
- Do not touch other origins' files, env vars, or routes.
- Do not put cron/scheduling in hono_bun. All scheduling lives in pg-boss inside the Next.js stack; hono_bun only reacts to HTTP calls.

---

## 11. Strong Opinions (summary)

- **Next.js single app + Hono notifier sidecar + pg-boss in Postgres.** No Redis, no n8n in the core path.
- **Conflict-free booking enforced in the DB** (exclusion constraint), not just in application code.
- **Encrypt firearms license numbers at the app layer.** DB-at-rest is not enough.
- **Versioned consent** for GDPR and range rules; every acceptance pins the version.
- **Audit log every admin action.** Non-negotiable.
- **Approval via signed single-use link + TOTP**, rate-limited, logged.
- **Soft delete / anonymize, never hard delete** users with booking/accounting history.
- **Backups automated with weekly restore test.**
- **VPS in CZ is fine** — EU jurisdiction, no special transfer paperwork for SK members.

Ready for the detailed plan when you are.
