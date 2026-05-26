# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code that touches Expo APIs, navigation, or native modules. Do not rely on training-data knowledge of older Expo versions.

## Commands

```bash
# Dev
expo start                # Start dev server
expo run:android          # Build + launch on Android
expo run:ios              # Build + launch on iOS (macOS only)

# Database
npm run db:generate       # Generate Drizzle migration from schema changes

# Types
npm run types:supabase    # Regenerate Supabase TypeScript types from remote schema

# Tests
npx vitest run            # Run all tests
npx vitest __tests__/sync/merge.test.ts   # Run a single test file
```

No linter is configured. TypeScript strict mode is the primary correctness check (`noImplicitAny`, `noImplicitReturns`, `noUncheckedIndexedAccess`).

## Architecture overview

### Routing

Expo Router v4 with typed routes (`experiments.typedRoutes: true`). File structure:

- `app/_layout.tsx` — Root: loads fonts, runs DB migrations, bootstraps auth, registers notification + sync listeners
- `app/(tabs)/` — Main 4-tab shell (Today, History, Stats, Settings)
- `app/(settings)/` — Settings modal group (stack inside a modal)
- `app/onboarding/` — First-run flow; blocked until `onboarding-store` marks `completed = true`
- `app/auth/` — Magic-link sign-in + verify screens

### Data flow

SQLite is the source of truth. All reads go to SQLite; Supabase is only the sync target.

```
UI → lib/mutations/ → db/repos/ → SQLite
                   → lib/sync/mark-pending (sets pending_sync=1)
                   → lib/sync/engine.ts (schedulePush, 5s debounce)
                             → push.ts → Supabase
                             → pull.ts → merge.ts → SQLite
```

React Query wraps all read queries (`lib/queries/`). Query keys are centralized in `lib/query-keys.ts`. After mutations, call `queryClient.invalidateQueries` with the appropriate key. staleTime is 30s globally.

### Sync engine (`lib/sync/`)

Push-before-pull with a 6-rule LWW merge (see `docs/sync-architecture.md` for the full decision log). Key rules:

- Rule (c): local pending + newer → local wins
- Rule (e): local pending + older → remote wins, conflict logged (the only true conflict)
- Rule (f): local clean → remote always wins

`SYNC-EXCLUDE` pattern: `reminderNotificationId` is device-local. `RemoteHabit` is typed with `Omit<Habit, 'reminderNotificationId' | 'pendingSync'>` — TypeScript enforces this at the push boundary.

Soft deletes: `deleted_at` (unix ms) on all tables; hard deletes are never used. UI queries always filter `WHERE deleted_at IS NULL`.

### Theme system (`theme/`)

`ThemeProvider` wraps the entire app and provides a `useTheme()` hook. Consume tokens from there; never hardcode colors, radii, or spacing.

- `theme/tokens.ts` — all design tokens (colors, radii, spacing, font sizes, font families)
- Theme preference (system/light/dark) persists to MMKV via `lib/stores/theme-store.ts`
- Background color transitions are animated via Reanimated on theme switch

### Animation rules

Every animation must use `useMotion()` from `lib/hooks/use-motion.ts`. This hook returns `{ reduced, timing(ms), spring(config), stagger(index) }` and gates animations behind the system reduce-motion preference. Never call `useReducedMotion()` directly elsewhere in the codebase.

### State management

- **Zustand** for cross-cutting app state: `stores/auth-store.ts`, `stores/onboarding-store.ts`, `stores/navigation-store.ts`, `lib/stores/theme-store.ts`, `lib/stores/sync-store.ts`
- **React Query** for all async data (habits, check-ins, stats, history)
- **MMKV** (`lib/storage.ts`) for persistent key-value (settings, auth tokens, sync timestamps). All keys are in the `StorageKey` enum.

### Forms

All forms use `react-hook-form` + `zod` resolvers (`@hookform/resolvers/zod`). Validation schema lives alongside the form component.

### Database schema changes

1. Edit `db/schema.ts`
2. Run `npm run db:generate` — this writes a new file to `db/migrations/`
3. The migration runs automatically on next app boot via `runMigrations()` in `app/_layout.tsx`
4. If the change needs a Supabase counterpart, write the SQL in `supabase/migrations/`

### Path alias

`@/` maps to the project root. Use it everywhere; no relative `../../` imports.
