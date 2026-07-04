import {
  Droplet,
  Sun,
  Moon,
  BookOpen,
  Dumbbell,
  Footprints,
  Leaf,
  Heart,
  PenLine,
  Music,
  Brain,
  Sparkles,
  Coffee,
  Apple,
  Bike,
  Mountain,
  Salad,
  Smile,
  Wind,
  Flame,
  Zap,
  Target,
  Feather,
  Headphones,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { HabitFormValues } from '@/lib/schemas/habit-form';

export const HABIT_ICONS: { name: string; Component: LucideIcon }[] = [
  { name: 'Droplet', Component: Droplet },
  { name: 'Sun', Component: Sun },
  { name: 'Moon', Component: Moon },
  { name: 'BookOpen', Component: BookOpen },
  { name: 'Dumbbell', Component: Dumbbell },
  { name: 'Footprints', Component: Footprints },
  { name: 'Leaf', Component: Leaf },
  { name: 'Heart', Component: Heart },
  { name: 'PenLine', Component: PenLine },
  { name: 'Music', Component: Music },
  { name: 'Brain', Component: Brain },
  { name: 'Sparkles', Component: Sparkles },
  { name: 'Coffee', Component: Coffee },
  { name: 'Apple', Component: Apple },
  { name: 'Bike', Component: Bike },
  { name: 'Mountain', Component: Mountain },
  { name: 'Salad', Component: Salad },
  { name: 'Smile', Component: Smile },
  { name: 'Wind', Component: Wind },
  { name: 'Flame', Component: Flame },
  { name: 'Zap', Component: Zap },
  { name: 'Target', Component: Target },
  { name: 'Feather', Component: Feather },
  { name: 'Headphones', Component: Headphones },
];

export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  HABIT_ICONS.map(({ name, Component }) => [name, Component]),
);

// 8 cool-palette colours (P11.7). Cohesive with the deep-blue + cyan theme.
// Light-mode values; sit on the cool side of the spectrum (blue → cyan → teal → violet).
export const HABIT_COLORS: string[] = [
  '#0066ff', // Azure  — primary blue (matches accent)
  '#06b6d4', // Cyan   — bright cyan
  '#0d9488', // Teal   — deep teal
  '#4f46e5', // Indigo — cool indigo
  '#7c3aed', // Violet — soft violet
  '#0284c7', // Sky    — sky blue
  '#475569', // Slate  — neutral slate
  '#10b981', // Mint   — cool mint-green
];

export function getDefaultFormValues(ritualId: string | null): HabitFormValues {
  return {
    name: '',
    ritualId: ritualId ?? '',
    icon: 'Sparkles',
    color: HABIT_COLORS[0] ?? '#0066ff',
    target: 1,
    reminderEnabled: false,
    reminderTime: null,
    reminderDays: '1111111',
    graceDaysPerWeek: 1,
  };
}
