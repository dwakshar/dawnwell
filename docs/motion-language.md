# Dawnwell Motion Language

Dawnwell is a calm utility. Every animation earns its place by communicating
state, rewarding the user, or smoothing a transition. Nothing animates for
decoration.

---

## Timing Baseline

| Category   | Duration | Used for                                         |
|------------|----------|--------------------------------------------------|
| Micro      | 200ms    | Taps, ripples, color shifts                      |
| Transition | 300ms    | Screen stack pushes, list entrances              |
| Entrance   | 400ms    | First-mount content, empty states               |
| Theme      | 250ms    | Theme toggle background transition              |

**Hard ceiling: 500ms.** Anything above 500ms is perceived as slow rather than
deliberate. The one exception is chart animations (600ms, ease-out) because the
data story benefits from a slightly longer read.

---

## Spring Config Baseline

```typescript
{ damping: 18, stiffness: 220, mass: 0.8 }
```

Responsive without jitter. Used as the default for all scale springs.

### Deviations

| Component       | Config                                     | Why                                                       |
|-----------------|--------------------------------------------|-----------------------------------------------------------|
| Check-in scale  | `{ damping: 18, stiffness: 220, mass: 0.8 }` | Baseline — the showcase interaction, well-tuned          |
| Flame increment | `{ damping: 14, stiffness: 260, mass: 0.7 }` | Slightly underdamped for a satisfying "pop" on streak up  |
| Button/icon press | `{ damping: 15, stiffness: 300 }`       | Faster return — UI affordance, not a celebration          |
| Offline bar     | `{ damping: 22, stiffness: 240 }`          | Firmer slide — status info, not a feature entrance        |

---

## Reduce-Motion Strategy

All animations use `useMotion()` from `lib/hooks/use-motion.ts`:

```typescript
const { reduced, timing, spring, stagger } = useMotion();
```

When `reduced` is true:
- `timing(duration)` → `0`
- `spring(config)` → `{ duration: 0 }`
- `stagger(index)` → `0`

Scale and slide animations are skipped entirely. Color and opacity changes that
communicate state still apply (e.g., check-in fill color, offline bar
appearing). Haptics always fire — they are not an animation.

`useReducedMotion()` from Reanimated appears **only** inside `use-motion.ts`.
All other code reads from `useMotion()`.

---

## The Check-in Interaction

The portfolio showpiece. Every design decision here is intentional:

```
Tap
 ├── Haptic: impactAsync(Medium) — fires immediately, not after
 ├── Scale: 1 → 0.94 → 1.04 → 1 (spring sequence, ~350ms)
 │   └── The brief compress before the pop sells the physicality
 ├── Tint: habit color at 10% opacity, fades over 500ms ease-out
 │   └── Reinforces which habit was tapped without being garish
 ├── Glow: surface-2 behind card, fades over 400ms ease-out
 │   └── Soft acknowledgement — NOT a confetti celebration
 └── Checkmark: scale + opacity spring into view

Long press (undo)
 ├── Haptic: selectionAsync — lighter, signals "undo" not "action"
 └── Checkmark: scale + opacity timing out (150ms)

Reduce-motion path: instant color change, no scale, no glow, haptic still fires.
```

Final spring config: `{ damping: 18, stiffness: 220, mass: 0.8 }` — tuned on
device to feel grounded, not bouncy.

---

## Haptics Table

Every interactive element fires a haptic. No exceptions.

| Interaction           | Haptic                              |
|-----------------------|-------------------------------------|
| Tab switch            | `selectionAsync`                    |
| Button press          | `selectionAsync` (on pressIn)       |
| Icon button press     | `selectionAsync` (on pressIn)       |
| Check-in              | `impactAsync(Medium)`               |
| Uncheck (long press)  | `selectionAsync`                    |
| Sheet open            | `selectionAsync`                    |
| Sheet dismiss         | none (gesture-driven)               |
| Destructive confirm   | `notificationAsync(Warning)`        |
| Sync success          | `notificationAsync(Success)` — settings sync only |
| Sync error            | `notificationAsync(Error)`          |
| Streak milestone      | `notificationAsync(Success)` — streak = 7, 30, 100 |
| Toggle (switch)       | `selectionAsync`                    |
| Segment control       | `selectionAsync`                    |

All haptics route through `lib/haptics.ts`, which respects the in-app
haptics setting and fails silently on emulator.

---

## Why Tab Switches Are Instant

Custom tab transition animations always feel laggy. React Navigation's
default tab behavior (instant switch) feels faster than any animated
alternative because the old screen stays in memory and the swap is a
single frame operation. Haptic feedback on tab press provides the tactile
confirmation that something happened.

---

## Why No LayoutAnimation on Android

`LayoutAnimation` (the legacy React Native API) produces unreliable results
on Android — it triggers unexpected re-layouts and the animation pipeline
differs from iOS. All layout-level animations use Reanimated's `entering`/
`exiting` props instead (`FadeInUp`, `SlideInDown`, etc.), which run on the
native UI thread via JSI and behave consistently across platforms.

---

## List Stagger Pattern

```typescript
// Mount-once: entering prop only fires when component first mounts.
// Reanimated's reconciler does not replay entering animations on re-renders
// as long as the item's key is stable.
<Animated.View
  entering={reduced ? undefined : FadeInUp.duration(300).delay(stagger(index, 80))}
>
```

`stagger(index, base)` from `useMotion` caps delay at 240ms (6 items × 40ms,
or 3 items × 80ms). Delays beyond 240ms make the last item feel abandoned.

Heatmap cells stagger by column index (0–6, delay = `col * 30ms`), not by
absolute cell index. Seven columns entering in sequence reads as a wave;
individual cells entering sequentially reads as noise.

---

## StreakFlame Idle Pulse

Fires only for streaks 7–29. The pulse is:
- 900ms ease-in-out up to 1.04 scale
- 900ms ease-in-out back to 1.0
- 6000ms pause via `withDelay`
- Total cycle: ~7.8s, `withRepeat(-1)`

Not continuous — a slowly breathing flame. A continuously pulsing element is
exhausting to look at within 30 seconds.

---

## Theme Transition

`ThemeProvider` holds a `modeProgress` shared value (0 = light, 1 = dark).
On theme change it animates to the new value with `withTiming(250ms)`. The
root `Animated.View` interpolates `backgroundColor` between
`tokens.colors.light.bg` and `tokens.colors.dark.bg`. This covers the app
chrome; individual screen backgrounds (which read `colors.bg` from context)
snap to the new value in the same render. The visual result is a smooth base
layer transition with instant content follow — no flash, no jarring repaint.

Reduce-motion: `modeProgress` snaps to target, no interpolation.
