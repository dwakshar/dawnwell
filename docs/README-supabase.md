# Supabase Setup — Dawnwell P9a

## Project details

| Field | Value |
|---|---|
| Project URL | `https://votlepjkdgkjxmjgavan.supabase.co` |
| Region | ap-south-1 (Mumbai) |
| Project ref | `votlepjkdgkjxmjgavan` |

---

## Dashboard steps (one-time, already done)

### 1. Auth settings
**Path:** Authentication → Providers → Email

- [x] Enable email provider
- [x] Enable magic links ("Magic Link" toggle ON)
- [x] Disable email+password ("Password-based logins" OFF)
- [x] Confirm email required ON (users must verify before session is granted)

### 2. Redirect URL (deep link)
**Path:** Authentication → URL Configuration → Redirect URLs

Add: `dawnwell://auth/callback`

This is the URL Supabase embeds in the magic-link email. The app captures it via
`Linking.addEventListener` in `app/_layout.tsx` and calls
`supabase.auth.exchangeCodeForSession(url)` (PKCE flow).

### 3. Email templates (optional hardening)
**Path:** Authentication → Email Templates → Magic Link

You can customise the email body. The default template includes the confirmation URL.
No changes required for P9a.

---

## Schema migrations

Run these in order in the Supabase SQL editor (**Database → SQL editor**) or via the CLI.

```
supabase/migrations/0001_initial.sql   — creates 5 tables + updated_at triggers + indexes
supabase/migrations/0002_rls.sql       — enables RLS + per-table own-rows policies
```

### Tables created

| Table | Purpose |
|---|---|
| `profiles` | One row per user; stores timezone and display name |
| `rituals` | Remote copy of local rituals (soft-delete via `deleted_at`) |
| `habits` | Remote copy of local habits — no `reminder_notification_id` (SYNC-EXCLUDE) |
| `check_ins` | Remote copy of local check-ins |
| `sync_meta` | Sync cursor; `last_pulled_at` / `last_pushed_at` written by P9b |

### SYNC-EXCLUDE note
The `reminder_notification_id` column on the local `habits` table is tagged
`SYNC-EXCLUDE` in `db/schema.ts`. It is intentionally absent from the remote `habits`
table — it is device-local and would be wrong on any other device.

---

## RLS verification

Run this in the SQL editor while logged in as User A (substitute real UUIDs):

```sql
-- Simulate being User A
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claim.sub" TO '<user_a_uuid>';

-- Attempt to read User B's rows — should return 0
SELECT count(*) FROM public.rituals  WHERE user_id = '<user_b_uuid>';
SELECT count(*) FROM public.habits   WHERE user_id = '<user_b_uuid>';
SELECT count(*) FROM public.check_ins WHERE user_id = '<user_b_uuid>';
```

All three should return `0`.

### Policies that needed USING + WITH CHECK split
All five tables use `FOR ALL … USING (…) WITH CHECK (…)`. This is intentional:
- `USING` guards SELECT and the filter side of UPDATE/DELETE
- `WITH CHECK` guards the new-row values on INSERT and UPDATE

A single `FOR ALL` policy with both clauses is correct and covers all four operations.
No table needed a per-operation split in P9a.

---

## Environment variables

| Variable | Where |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` (local), EAS secret (CI/CD) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` (local), EAS secret (CI/CD) |

Both are read at build time via `app.config.ts → extra` and validated at runtime in
`lib/env.ts` (throws with a clear message if missing).

### EAS secrets (run once per secret)
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL     --value "https://votlepjkdgkjxmjgavan.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>"
```

---

## Regenerating TypeScript types

After any schema change, regenerate `lib/supabase/database.types.ts`:

```bash
npm run types:supabase
```

Requires the Supabase CLI to be installed (`npm install -g supabase`) and logged in
(`supabase login`).

---

## Android — Gmail in-app browser (known flaky area)

The magic-link email opened inside the Gmail app on Android uses Chrome Custom Tabs
(an in-app browser). Deep-link schemes (`dawnwell://`) cannot be triggered from inside
Custom Tabs — the OS won't dispatch them.

**Workaround confirmed working:**
Tell the user to open the link in the system browser instead of the in-app one.
In the Gmail app: three-dot menu → "Open in Chrome" (or default browser).

The verify screen's "Open mail app" CTA (`mailto:`) opens the native mail client, not
the Gmail in-app browser, so it side-steps the issue entirely on first open.
If the user has already opened the link in Custom Tabs and it failed, they need to
long-press the link → "Open in browser".

Document this in app FAQ / onboarding tooltip for P10.
