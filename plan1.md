# Strelnica — Implementation Plan (plan1)

Concrete, phased plan derived from `recommend.md`. Each phase has: scope, deliverables, tasks, and exit criteria. Nothing in this plan contradicts `recommend.md` — it operationalizes it.

Two codebases involved:
- **`/Users/pictus/PW-Local-Projects/strelnica`** — the Next.js web app (this repo; currently empty).
- **`/Users/pictus/PW-Local-Projects/hono_bun`** — existing shared notifier. We add a new `strelnica` origin; we do not modify other origins.

---

## 0. Conventions

- Package manager: **bun** for both repos (hono_bun already uses it; strelnica Next.js will too).
- Node runtime only in Next.js — no edge.
- TypeScript strict.
- Date/time: all timestamps `timestamptz`; business logic in Europe/Bratislava; UI renders in user's locale.
- IDs: `uuid v7` for `users`, `bookings`, etc.; short stable codes for `ranges` (`R50`, `RBR`).
- Import alias: `@/` → `src/` (Next.js) or `./src/` (hono_bun, existing).
- Branch model: `main` = production; feature branches; PRs to `main`; Coolify deploys from `main` after CI.

---

## 1. Env var matrix

### strelnica (Next.js)

```
# DB
DATABASE_URL=postgres://...

# Auth
AUTH_SECRET=...                        # NextAuth/Auth.js session secret
AUTH_URL=https://strelnica.tld

# OTP / verification (shape from next_pw_podcast)
OTP_SALT=...
VERIFICATION_SESSION_SECRET=...

# App-layer encryption for zbrojný preukaz, TOTP secrets
APP_ENCRYPTION_KEY=...                 # 32 bytes, base64
APP_ENCRYPTION_KEY_PREVIOUS=           # optional, for rotation

# Admin approval codes pepper
ADMIN_CODE_PEPPER=...

# Hono notifier
NEXT_PUBLIC_HONO_API_URL=https://hono.pictusweb.sk
STRELNICA_API_TOKEN=...                # bearer to hono_bun /api/strelnica/*

# Public
NEXT_PUBLIC_APP_URL=https://strelnica.tld
DEFAULT_LOCALE=sk
SUPPORTED_LOCALES=sk,hu

# pg-boss
PGBOSS_SCHEMA=pgboss
```

### hono_bun (append to existing `.env`)

```
STRELNICA_MAILER_USERNAME=...
STRELNICA_MAILER_PASSWORD=...
STRELNICA_MAILER_FROM="Strelnica <no-reply@strelnica.tld>"
STRELNICA_MAILER_BCC=archive@strelnica.tld
STRELNICA_API_TOKEN=...                # must match strelnica value
STRELNICA_WEB_ORIGIN=https://strelnica.tld
# SMSTOOLS_API_KEY already present
```

---

## 2. Full Drizzle schema (target state)

File: `src/db/schema/*.ts`. Grouped for clarity; one file per table is fine.

```ts
// ranges.ts
export const ranges = pgTable('ranges', {
  id: text('id').primaryKey(),                 // 'R50' | 'RBR'
  nameSk: text('name_sk').notNull(),
  nameHu: text('name_hu').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

// users.ts
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  phoneE164: text('phone_e164').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  birthDate: date('birth_date'),
  birthPlace: text('birth_place'),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressZip: text('address_zip'),
  addressCountry: text('address_country').default('SK'),
  zbrojnyPreukazNumberEncrypted: text('zbrojny_preukaz_number_encrypted'),
  zbrojnyPreukazCategory: text('zbrojny_preukaz_category'),          // 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  zbrojnyPreukazIssuedAt: date('zbrojny_preukaz_issued_at'),
  zbrojnyPreukazExpiresAt: date('zbrojny_preukaz_expires_at'),
  zbrojnyPreukazIssuingAuthority: text('zbrojny_preukaz_issuing_authority'),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['invited','pending_verification','active','suspended','anonymized'] })
    .notNull().default('invited'),
  locale: text('locale', { enum: ['sk','hu'] }).notNull().default('sk'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  invitedBy: uuid('invited_by').references(() => users.id),
  invitationTokenHash: text('invitation_token_hash'),
  invitationExpiresAt: timestamp('invitation_expires_at', { withTimezone: true }),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
  adminApprovalCodeHash: text('admin_approval_code_hash'),           // admins only
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastLoginIp: text('last_login_ip'),
  gdprConsentVersion: text('gdpr_consent_version'),
  gdprConsentAt: timestamp('gdpr_consent_at', { withTimezone: true }),
  rangeRulesConsentVersion: text('range_rules_consent_version'),
  rangeRulesConsentAt: timestamp('range_rules_consent_at', { withTimezone: true }),
  notesAdmin: text('notes_admin'),
  anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
})

// memberships.ts — composite PK (user_id, year)
export const memberships = pgTable('memberships', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  year: integer('year').notNull(),
  feeAmount: numeric('fee_amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('EUR'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentMethod: text('payment_method', { enum: ['cash','transfer','other'] }),
  recordedBy: uuid('recorded_by').references(() => users.id),
  note: text('note'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledReason: text('cancelled_reason'),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.year] }) }))

// opening_hours_templates.ts
export const openingHoursTemplates = pgTable('opening_hours_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  rangeId: text('range_id').notNull().references(() => ranges.id),
  weekday: integer('weekday').notNull(),            // 0=Sun .. 6=Sat
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),                        // null = current
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// closures.ts
export const closures = pgTable('closures', {
  id: uuid('id').defaultRandom().primaryKey(),
  rangeId: text('range_id').references(() => ranges.id),   // null = both ranges
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  reasonSk: text('reason_sk'),
  reasonHu: text('reason_hu'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// bookings.ts — with exclusion constraint via raw SQL in migration
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  rangeId: text('range_id').notNull().references(() => ranges.id),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: text('status', {
    enum: ['requested','approved','declined','cancelled','checked_in','completed','no_show']
  }).notNull().default('requested'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decisionReason: text('decision_reason'),
  checkInAt: timestamp('check_in_at', { withTimezone: true }),
  autoCompletedAt: timestamp('auto_completed_at', { withTimezone: true }),
  effectiveMinutes: integer('effective_minutes'),
  guestCount: integer('guest_count').notNull().default(0),
  userNote: text('user_note'),
  adminNote: text('admin_note'),
  reminderJobId: text('reminder_job_id'),
  noshowJobId: text('noshow_job_id'),
  expiryJobId: text('expiry_job_id'),
  rulesConsentVersionAtBooking: text('rules_consent_version_at_booking').notNull(),
})
// Migration also adds:
//   ALTER TABLE bookings ADD COLUMN time_range tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at)) STORED;
//   CREATE EXTENSION IF NOT EXISTS btree_gist;
//   ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
//     EXCLUDE USING gist (range_id WITH =, time_range WITH &&)
//     WHERE (status IN ('requested','approved','checked_in'));

// verification_codes.ts  (shape copied from next_pw_podcast)
export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),                 // member UUID, or email during onboarding
  purpose: varchar('purpose', { length: 30 }).notNull(),
  codeHash: char('code_hash', { length: 64 }).notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxUser: index().on(t.userId),
  idxPurpose: index().on(t.purpose),
}))

// admin_approval_tokens.ts
export const adminApprovalTokens = pgTable('admin_approval_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  adminUserId: uuid('admin_user_id').notNull().references(() => users.id),
  action: text('action', { enum: ['approve','decline'] }).notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  usedIp: text('used_ip'),
})

// contact_messages.ts
export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  message: text('message').notNull(),
  locale: text('locale', { enum: ['sk','hu'] }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  handledBy: uuid('handled_by').references(() => users.id),
})

// notifications_log.ts
export const notificationsLog = pgTable('notifications_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  channel: text('channel', { enum: ['email','sms'] }).notNull(),
  to: text('to').notNull(),
  template: text('template').notNull(),
  locale: text('locale', { enum: ['sk','hu'] }).notNull(),
  subject: text('subject'),
  bodyHash: char('body_hash', { length: 64 }),
  bookingId: uuid('booking_id').references(() => bookings.id),
  userId: uuid('user_id').references(() => users.id),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  providerResponse: jsonb('provider_response'),
  status: text('status', { enum: ['sent','failed','retrying'] }).notNull(),
})

// audit_log.ts
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeJsonb: jsonb('before_jsonb'),
  afterJsonb: jsonb('after_jsonb'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// consent_documents.ts
export const consentDocuments = pgTable('consent_documents', {
  kind: text('kind', { enum: ['gdpr','range_rules','terms'] }).notNull(),
  version: text('version').notNull(),
  locale: text('locale', { enum: ['sk','hu'] }).notNull(),
  contentMd: text('content_md').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  publishedBy: uuid('published_by').notNull().references(() => users.id),
}, (t) => ({ pk: primaryKey({ columns: [t.kind, t.version, t.locale] }) }))
```

Auth.js tables (`sessions`, `accounts`, `verificationTokens`) per the adapter chosen.

### Seed
- Ranges: `('R50', '50 metrov', '50 méter', true, 1)`, `('RBR', 'Broková strelnica', 'Sörétes lőtér', true, 2)`.
- First admin user: invited via CLI script `bun run seed:admin` (email, phone, temp password + forced TOTP setup on first login).
- Consent document v1 stubs (SK + HU) for `gdpr`, `range_rules`.

---

## 3. Route map (Next.js)

```
src/app/
├── [locale]/
│   ├── layout.tsx                              # i18n shell
│   ├── (public)/
│   │   ├── page.tsx                            # landing + view-only calendar
│   │   ├── kontakt/page.tsx
│   │   ├── gdpr/page.tsx
│   │   ├── pravidla-strelnice/page.tsx
│   │   ├── impressum/page.tsx
│   │   └── pozvanka/[token]/page.tsx           # invitation acceptance
│   ├── prihlasenie/page.tsx                    # login
│   ├── app/                                    # member area (auth gate in layout)
│   │   ├── layout.tsx
│   │   ├── page.tsx                            # dashboard
│   │   ├── rezervacie/page.tsx
│   │   ├── rezervacie/nova/page.tsx
│   │   ├── profil/page.tsx
│   │   ├── profil/export/route.ts              # GDPR data export
│   │   └── statistiky/page.tsx
│   └── admin/                                  # admin area (auth + TOTP gate)
│       ├── layout.tsx
│       ├── page.tsx                            # today + pending requests
│       ├── pouzivatelia/page.tsx
│       ├── pouzivatelia/[id]/page.tsx
│       ├── rezervacie/page.tsx
│       ├── clenstvo/page.tsx
│       ├── otvaracie-hodiny/page.tsx
│       ├── uzavretia/page.tsx
│       ├── statistiky/page.tsx
│       ├── statistiky/export.pdf/route.ts
│       ├── audit/page.tsx
│       └── decide/[token]/page.tsx             # out-of-band approval
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── cron/
│   │   └── health/route.ts                     # Coolify / Uptime Kuma probe
│   ├── check-in/route.ts                       # deep link from reminder SMS
│   └── webhooks/                               # (reserved)
└── middleware.ts                               # locale + auth gating
```

Server Actions live next to the pages that use them (`src/app/[locale]/app/rezervacie/actions.ts`), typed by zod.

---

## 4. Server Action + Route Handler surface

### Server Actions (mutations)

Auth / user
- `inviteMember(data)` — admin only; creates invited user, sends `invitation` email via hono_bun.
- `acceptInvitation(token, data)` — public; sets password + consents, verifies email+phone via OTP.
- `requestEmailOtp(purpose)`, `verifyEmailOtp(token, code)`
- `requestPhoneOtp(purpose)`, `verifyPhoneOtp(token, code)`
- `enableTotp(secret, code)`, `disableTotp(password)`
- `changePassword(oldPw, newPw)`
- `requestPasswordReset(email)`, `resetPassword(token, newPw)`
- `updateProfile(patch)` — limited fields members may edit.
- `requestAnonymization()` — member-initiated; admin must confirm.

Member booking
- `requestBooking({ rangeId, startsAt, hours, guestCount, userNote, rulesVersion })`
  - Validates eligibility (membership, non-expired license, consent current).
  - Inserts booking inside transaction (exclusion constraint enforces no overlap).
  - Schedules pg-boss `booking.requestExpiry` job at +24h.
  - Enqueues `notify.admins.bookingRequest` job.
- `cancelBooking(id)` — member's own, future-dated only.
- `checkInBooking(id)` — member taps "I'm here".

Admin
- `approveBookingByToken(token, adminTotp)` — via `/admin/decide/...`; idempotent; records IP.
- `declineBookingByToken(token, adminTotp, reason)`
- `approveBookingInline(id)` / `declineBookingInline(id, reason)` — admin UI, session auth + TOTP-freshness check.
- `createBookingOnBehalf(userId, ...)` — admin creates + auto-approves.
- `editOpeningHours(...)`, `deleteOpeningHoursTemplate(id)`
- `createClosure(...)`, `deleteClosure(id)`
- `markMembershipPaid(userId, year, data)`
- `setUserStatus(id, status)` — suspend / reactivate
- `anonymizeUser(id)` — two-step, second confirm writes audit + overwrites PII.
- `publishConsentDocument(kind, version, locale, contentMd)`
- `rotateAdminApprovalCode()`

### Route Handlers
- `/api/auth/[...nextauth]/route.ts`
- `/api/check-in/route.ts?t=<signed>` — member-side deep link; validates signed token, calls `checkInBooking`.
- `/api/[locale]/app/profil/export/route.ts` — streams GDPR JSON+PDF.
- `/api/[locale]/admin/statistiky/export.pdf/route.ts` — admin PDF.
- `/api/cron/health/route.ts` — 200 OK + DB ping.

---

## 5. pg-boss job catalog

All jobs idempotent; each handler guards against the target booking having moved on.

| Job | Schedule | Payload | Purpose |
|---|---|---|---|
| `booking.requestExpiry` | oneoff, `+24h` after request | `{bookingId}` | Auto-decline if still `requested` |
| `booking.reminder` | oneoff, `startsAt − 5min` | `{bookingId}` | SMS + email "I'm here" prompt |
| `booking.noShowSweep` | oneoff, `startsAt + 15min` | `{bookingId}` | Mark `no_show` if not checked in |
| `booking.autoComplete` | oneoff, `endsAt` | `{bookingId}` | Mark `completed`, compute `effectiveMinutes` |
| `notify.admins.bookingRequest` | instant | `{bookingId}` | Issue per-admin approval tokens, call hono_bun |
| `notify.member.bookingApproved` | instant | `{bookingId}` | Call hono_bun |
| `notify.member.bookingDeclined` | instant | `{bookingId}` | Call hono_bun |
| `notify.member.bookingCancelled` | instant | `{bookingId}` | Call hono_bun |
| `notify.member.noShowNotice` | instant | `{bookingId}` | Call hono_bun |
| `notify.contactMessage` | instant | `{contactMessageId}` | Relay to admin emails |
| `license.expiryScan` | cron, daily 03:00 | — | For each member with license expiring in 60/30/7 days, enqueue notify |
| `notify.member.licenseExpiring` | instant | `{userId, daysLeft}` | Call hono_bun |
| `membership.rolloverCreate` | cron, Jan 1 00:05 | — | Create unpaid `memberships` rows for next year for all active members |
| `membership.reminder` | cron, Dec 15 + Jan 5 | — | Nag members without paid row for current year |
| `retention.sweep` | cron, daily 04:00 | — | Anonymize / delete per §8 of recommend.md |
| `notifications.outbox` | instant | `{channel, to, template, data}` | Generic fallback — in practice we call hono_bun directly |

Every pg-boss invocation that calls hono_bun sends header `Authorization: Bearer $STRELNICA_API_TOKEN`.

---

## 6. hono_bun work (additive)

Follow layout in §10.1 of `recommend.md`.

Files to create (none of these exist yet):

```
hono_bun/src/routes/strelnica/
  invitation.ts
  otp.ts                        # both email + sms OTP handlers
  bookingRequestToAdmin.ts
  bookingApproved.ts
  bookingDeclined.ts
  bookingReminder.ts
  bookingCancelled.ts
  noShowNotice.ts
  licenseExpiring.ts
  membershipReminder.ts
  contact.ts
  passwordReset.ts

hono_bun/src/services/strelnica/
  sendInvitationEmail/invitation.ts
  sendOtpEmail/otp.ts
  sendOtpSms/sms.ts
  sendBookingRequestAdminEmail/adminRequest.ts
  sendBookingRequestAdminSms/adminRequest.ts
  sendBookingApprovedEmail/approved.ts
  sendBookingApprovedSms/approved.ts
  sendBookingDeclinedEmail/declined.ts
  sendBookingReminderEmail/reminder.ts
  sendBookingReminderSms/reminder.ts
  sendBookingCancelledEmail/cancelled.ts
  sendNoShowNoticeEmail/noShow.ts
  sendLicenseExpiringEmail/licenseExpiring.ts
  sendLicenseExpiringSms/licenseExpiring.ts
  sendMembershipReminderEmail/membership.ts
  sendContactEmail/contact.ts
  sendPasswordResetEmail/passwordReset.ts

hono_bun/src/templates/emailTemplates/strelnica/
  InvitationEmail.tsx
  VerificationOtpEmail.tsx
  TwoFactorOtpEmail.tsx
  BookingRequestAdminEmail.tsx
  BookingApprovedEmail.tsx
  BookingDeclinedEmail.tsx
  BookingReminderEmail.tsx
  BookingCancelledEmail.tsx
  NoShowNoticeEmail.tsx
  LicenseExpiringEmail.tsx
  MembershipReminderEmail.tsx
  ContactFormAdminEmail.tsx
  PasswordResetEmail.tsx

hono_bun/src/utils/strelnica/
  auth.ts                       # requireStrelnicaAuth(c): 401 if bearer mismatch
  validation.ts                 # zod-or-manual validators for each payload
  smsMessages.ts                # SK/HU message builders (short, UCS-2-aware)
```

Edit `hono_bun/src/routes/index.ts` — append the `// strelnica` block from §10.3 of `recommend.md`. Do not touch any other origin.

---

## 7. Phases & exit criteria

### M0 — Foundation (no user-visible feature)

- Init Next.js via `bun create next-app@latest`; strict TS; Tailwind; shadcn init.
- `next-intl` set up with `[locale]` segment, `sk`/`hu` messages scaffolding.
- Drizzle + `postgres` driver; initial migration creates all tables from §2 minus seed.
- pg-boss schema bootstrap (`boss.start()` on app boot, `PGBOSS_SCHEMA=pgboss`).
- Auth.js v5 skeleton: session table, credentials provider, empty callbacks.
- Middleware: locale detection + auth gating placeholders for `/app` and `/admin`.
- `Dockerfile` + `docker-compose.dev.yml` (app + Postgres).
- CI: lint + typecheck + build.
- Coolify: staging project created, env vars populated, deploy succeeds on merge.

**Exit**: `bun run build` passes; migrations run green on staging; `/api/cron/health` returns 200 with DB ping.

### M1 — User lifecycle

- `inviteMember` Server Action + admin UI stub (just a form) to create invitations.
- `/pozvanka/[token]` page: password, TOTP optional (member), consent acceptance with versions.
- Email + SMS OTP wiring against hono_bun `/api/strelnica/otp/*` (once those exist — parallel M4 work).
- Login with email/phone + password; admin login forces TOTP.
- Password reset flow end-to-end.
- Profile view/edit; GDPR data export endpoint returns JSON + PDF.
- Admin: list/edit users, suspend, rotate TOTP, anonymize (2-step confirm).
- Audit log writes on: invite, accept, login, status change, anonymize, password reset.

**Exit**: fresh invitee can go from link → activation → login → profile view, both SK and HU. All admin user-management actions appear in `audit_log` with `before_jsonb`/`after_jsonb`.

### M2 — Booking core (no notifications yet)

- `ranges` seeded; `opening_hours_templates` editor UI (admin, simple weekly grid per range).
- Closure editor UI (admin).
- Public landing calendar: renders availability per range for current + next week, read-only.
- Member `requestBooking` Server Action with full validation + exclusion constraint.
- Member bookings list + cancel.
- Admin bookings list with filters (range, user, status, date range).
- pg-boss `booking.requestExpiry` job wired.

**Exit**: two members cannot book the same range/time; attempt returns a friendly "already taken" message. Exclusion constraint proven via a concurrent-insert test script.

### M3 — Admin approval (still no SMS)

- `admin_approval_tokens` issuance on request: one row per admin, unique single-use hash, 24h TTL.
- `/admin/decide/[token]` page: displays booking summary, requires admin TOTP before POST.
- `approveBookingByToken` / `declineBookingByToken` server actions; mark token used; invalidate sibling tokens; write audit.
- Inline approve/decline from `/admin` dashboard.
- Admin dashboard shows pending queue sorted by `requestedAt`.

**Exit**: approval and decline flows work via both the email link and the dashboard; second admin's token auto-invalidates after first decides; audit entries capture IP + actor.

### M4 — Notifications (hono_bun integration)

- Scaffold strelnica origin in hono_bun (§6 files above).
- Add bearer-token middleware (`requireStrelnicaAuth`).
- Build all 13 React-Email templates, SK + HU inline translations (barubo style).
- Build all SMS message builders in `utils/strelnica/smsMessages.ts` (short, UCS-2 aware).
- Wire pg-boss `notify.*` jobs to POST the correct payloads.
- `notifications_log` writes on every send (status + provider response).
- Register `Strelnica` sender name with smstools.sk (out-of-band action item).

**Exit**: every domain event (invitation, OTP, request-to-admin, approved, declined, reminder, cancelled, no-show, license-expiring, membership-reminder, contact, password-reset) delivers in both SK and HU in staging. Retries on a forced notifier failure succeed via pg-boss.

### M5 — Check-in & statistics

- `booking.reminder`, `booking.noShowSweep`, `booking.autoComplete` jobs.
- Signed check-in deep link (`/api/check-in?t=...`) used from SMS.
- Admin/tablet check-in UI on today's schedule.
- Member stats page: shooting hours, visits, per month/quarter/year.
- Admin stats page: same, all members, with filters (active, paying, etc.).
- PDF export (`@react-pdf/renderer`) for admin stats.

**Exit**: full lifecycle of a booking runs unattended: request → approve → reminder at T-5 → check-in → auto-complete at end → counts in stats.

### M6 — Legal, audit viewer, retention

- Consent documents CMS (admin-only editor + publish) with version bump.
- Public `/gdpr` and `/pravidla-strelnice` render latest published version for current locale.
- At next login after version bump, user must re-accept.
- Audit log viewer UI (filters: actor, action, entity, date range).
- `retention.sweep` job implementing the table in §8 of `recommend.md`.
- Legal page translations reviewed by a Slovak/Hungarian speaker (out-of-band).

**Exit**: a consent bump triggers re-acceptance for all active users on next login. Retention sweep anonymizes test fixtures older than the configured period.

### M7 — Production hardening & launch

- Security headers (CSP, HSTS, frame-options, referrer-policy) via middleware — verified with `securityheaders.com`.
- Rate limits on every mutation (pattern from `next_pw_podcast/lib/rateLimit.ts`).
- Glitchtip integration + Uptime Kuma probes.
- Nightly `pg_dump` to offsite storage, encrypted; automated weekly restore test script.
- Load test the booking request endpoint (small — 20 concurrent requesters, ensure exclusion constraint holds).
- Lawyer/DPO review of GDPR + retention policy text (out-of-band).
- Sender approval for SMS (smstools.sk) confirmed.
- Staging → production DNS cutover; monitor 48h.

**Exit**: production live, first real member invited, end-to-end booking → approve → reminder → check-in tested with live SMS.

---

## 8. Testing strategy

- **Unit**: zod validators, availability calculation, retention predicates, OTP hash functions.
- **Integration**: Server Actions against a real Postgres in docker-compose; exclusion-constraint race test (two concurrent `requestBooking` for same slot).
- **E2E**: Playwright covering: invitation → accept → login → book → approve (via email link) → reminder arrives (mock hono_bun) → check-in → complete. Both SK and HU locales.
- **Manual**: tablet session on an iPad / iPad Air emulator; screen-reader smoke on VoiceOver; keyboard-only admin flow.
- **Load**: small k6 or autocannon script to verify overlap prevention under concurrency.
- **Backup**: weekly automated restore into a scratch DB + smoke check.

---

## 9. Open items to resolve before M1

Small decisions that don't block M0 but will block M1.

1. **Invitation TTL** — proposed 72h.
2. **Admin session TTL** — proposed 2h sliding; re-auth required for anonymize + publishConsent.
3. **Member no-show penalty** — proposed: 3 no-shows in a season → admin-flag, not auto-block.
4. **Cancellation lead time** — proposed: anytime up to `startsAt`.
5. **License-expiry schedule** — proposed 60/30/7 days before, one email + one SMS each.
6. **Membership rollover timing** — proposed Dec 15 + Jan 5 reminders.
7. **Admin daily digest** — proposed yes, 07:00 local, list of today's bookings.

I'll treat these defaults as accepted unless you say otherwise when we start M1.

---

## 10. Out of scope for v1 (defer)

- Waitlist when an approved booking is cancelled.
- Public-facing pricing.
- Guest web booking (explicitly out per §0 of `recommend.md`).
- Tablet offline/PWA mode.
- Online payments.
- Multi-admin shift rotation / "on duty" scheduler.
- Mobile native apps.

---

## 11. Risk register

| Risk | Mitigation |
|---|---|
| SMS sender name `Strelnica` not approved by smstools.sk | Apply for approval during M0; fall back to a pre-approved sender if denied |
| Firearms-register retention requirement turns out to differ from §8 of recommend.md | Confirm with lawyer + local police during M6; retention job is table-driven so easy to tune |
| HU translation churn slows M6 | Keep SK as source-of-truth; HU translations maintained by bilingual collaborator; fall back to SK in UI if HU key missing (next-intl supports this) |
| Race condition in booking insert | Exclusion constraint is the defence; add concurrency test in M2 |
| Admin loses their TOTP device | Pre-built recovery: other admin can reset via `/admin/pouzivatelia/[id]` with audit write + SMS fallback |
| hono_bun outage blocks onboarding | pg-boss retries; invitation accept doesn't strictly require SMS arrival in real-time (token is valid 72h) |

---

## 12. First concrete tasks (M0 kickoff)

1. `cd /Users/pictus/PW-Local-Projects/strelnica && bun create next-app@latest . --typescript --app --tailwind --src-dir --import-alias "@/*"`
2. Add deps: `drizzle-orm postgres drizzle-kit next-auth@beta next-intl @hookform/resolvers zod react-hook-form @react-email/render @react-email/components pg-boss @react-pdf/renderer date-fns argon2 otplib`.
3. shadcn init; add base components (button, input, form, dialog, table, tabs, calendar).
4. Scaffold `src/db/schema/*` per §2; wire `drizzle.config.ts`; generate initial migration.
5. `docker-compose.dev.yml` with Postgres 16 + adminer.
6. `src/middleware.ts` for `[locale]` routing; `i18n/` messages scaffolding.
7. Auth.js config with empty providers; session table migration.
8. First Coolify deploy of staging — verify Next.js serves, DB connects, migrations ran.

Once M0 is green, we start M1.
