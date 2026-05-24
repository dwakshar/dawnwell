# Dawnwell

Offline-first habit tracker for iOS + Android. Ritual-based daily habits with streaks, grace days, and local-first SQLite synced to Supabase.

## Stack

- **React Native** 0.85 · New Architecture enabled
- **Expo SDK** 56 · Managed workflow
- **Expo Router** v4 · File-based, typed routes
- **TypeScript** 6 · Strict mode
- **Fonts** — Fraunces (display), Inter (sans), JetBrains Mono (mono)

## Dev commands

```sh
pnpm start          # Start Expo dev server
pnpm android        # Open on Android
pnpm ios            # Open on iOS (macOS only)
pnpm web            # Open in browser
```

## Bundle IDs

- iOS: `app.dwakshar.dawnwell`
- Android: `app.dwakshar.dawnwell`

## Build phases

- **Phase 0** — Scaffold, tokens, theme provider, router shell ← *current*
- Phase 1 — Primitives library
- Phase 2 — Persistence layer (MMKV + SQLite)
- Phase 3–12 — Features
- Phase 12 — Assets, icons, splash
